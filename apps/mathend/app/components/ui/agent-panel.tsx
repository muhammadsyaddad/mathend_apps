"use client";

import {
  Ellipsis,
  Loader2,
  SendHorizontal,
  Sparkles,
  Unplug,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

type AgentPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  activeFile: AgentWorkspaceFile | null;
  onOverwriteActiveFile: (fileId: string, nextContent: string) => boolean;
  onAppendToActiveFile: (fileId: string, appendContent: string) => boolean;
  onReplaceInActiveFile: (
    fileId: string,
    find: string,
    replaceWith: string,
  ) => number;
};

type AgentWorkspaceFile = {
  id: string;
  title: string;
  content: string;
};

type ProviderConnection = {
  providerId: string;
  providerLabel: string;
  accountLabel: string;
  connectedAt: string;
  mode: "oauth";
};

type AgentProvider = {
  id: string;
  label: string;
  configured: boolean;
  connected: boolean;
  chatReady?: boolean;
  connection?: ProviderConnection;
};

type OAuthConnectResponse = {
  flow?: "authorization_code" | "device_code";
  authorizationUrl?: string;
  verificationUri?: string;
  verificationUriComplete?: string;
  userCode?: string;
  intervalSeconds?: number;
  expiresIn?: number;
  error?: string;
};

type DevicePollResponse = {
  connected?: boolean;
  pending?: boolean;
  retryAfterSeconds?: number;
  providerId?: string;
  error?: string;
};

type PendingDeviceAuth = {
  providerId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  intervalSeconds: number;
  expiresAt: number;
};

type AgentChatMessage = {
  id: string;
  role: "user" | "assistant";
  providerLabel: string;
  content: string;
};

type WorkspaceCommand =
  | {
      kind: "read";
    }
  | {
      kind: "write";
      content: string;
    }
  | {
      kind: "append";
      content: string;
    }
  | {
      kind: "replace";
      find: string;
      replaceWith: string;
    }
  | {
      kind: "format";
    }
  | {
      kind: "help";
    };

type WorkspaceCommandSuggestion = {
  id: string;
  shortcut: string;
  label: string;
  description: string;
  insertText: string;
  cursorOffset?: number;
};

type AgentModelOption = {
  label: string;
  value: string;
};

type AgentModelListResponse = {
  models?: AgentModelOption[];
  error?: string;
};

type AgentWorkspaceAction =
  | {
      kind: "write";
      content: string;
    }
  | {
      kind: "append";
      content: string;
    }
  | {
      kind: "replace";
      find: string;
      replaceWith: string;
    };

type AgentChatResponse = {
  providerLabel?: string;
  message?: string;
  workspaceActions?: AgentWorkspaceAction[];
  error?: string;
};

type AgentChatStreamEvent =
  | {
      type: "plan";
      plan?: string;
    }
  | {
      type: "delta";
      delta?: string;
    }
  | ({
      type: "done";
    } & AgentChatResponse)
  | {
      type: "error";
      error?: string;
    };

const GITHUB_PROVIDER_ID = "github-copilot";

const WORKSPACE_TOOL_LABEL = "Workspace Tool";
const FALLBACK_FILE_SESSION_ID = "__no_file__";
const EMPTY_SESSION_MESSAGES: AgentChatMessage[] = [];

const parseWorkspaceCommand = (input: string): WorkspaceCommand | null => {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\/(help|tools|commands)$/i.test(trimmed)) {
    return { kind: "help" };
  }

  if (/^\/(format|fmt)\b/i.test(trimmed)) {
    return { kind: "format" };
  }

  if (/^\/(read|cat)\b/i.test(trimmed)) {
    return { kind: "read" };
  }

  const writeMatch = trimmed.match(/^\/write\s+([\s\S]+)$/i);
  if (writeMatch) {
    return {
      kind: "write",
      content: writeMatch[1] ?? "",
    };
  }

  const appendMatch = trimmed.match(/^\/append\s+([\s\S]+)$/i);
  if (appendMatch) {
    return {
      kind: "append",
      content: appendMatch[1] ?? "",
    };
  }

  const quotedDoubleReplaceMatch = trimmed.match(
    /^\/replace\s+"([\s\S]+)"\s+"([\s\S]*)"$/i,
  );
  if (quotedDoubleReplaceMatch) {
    return {
      kind: "replace",
      find: quotedDoubleReplaceMatch[1] ?? "",
      replaceWith: quotedDoubleReplaceMatch[2] ?? "",
    };
  }

  const quotedSingleReplaceMatch = trimmed.match(
    /^\/replace\s+'([\s\S]+)'\s+'([\s\S]*)'$/i,
  );
  if (quotedSingleReplaceMatch) {
    return {
      kind: "replace",
      find: quotedSingleReplaceMatch[1] ?? "",
      replaceWith: quotedSingleReplaceMatch[2] ?? "",
    };
  }

  const arrowReplaceMatch = trimmed.match(
    /^\/replace\s+([\s\S]+?)\s*=>\s*([\s\S]*)$/i,
  );
  if (arrowReplaceMatch) {
    const find = arrowReplaceMatch[1]?.trim() ?? "";
    return {
      kind: "replace",
      find,
      replaceWith: arrowReplaceMatch[2] ?? "",
    };
  }

  return null;
};

const getWorkspaceHelpText = (): string => {
  return [
    "Workspace commands:",
    "/format - normalize active file into Typst-first clean syntax",
    "/read - show active file content",
    "/write <content> - replace active file with content",
    "/append <content> - append content at the end",
    "/replace <find> => <replace> - replace all matches",
    '/replace "find text" "replace text" - quoted variant',
  ].join("\n");
};

const WORKSPACE_COMMAND_SUGGESTIONS: WorkspaceCommandSuggestion[] = [
  {
    id: "ws-format",
    shortcut: "/format",
    label: "Format active file",
    description: "Normalize syntax to Typst-first clean format",
    insertText: "/format",
  },
  {
    id: "ws-read",
    shortcut: "/read",
    label: "Read active file",
    description: "Show content from the selected file session",
    insertText: "/read",
  },
  {
    id: "ws-write",
    shortcut: "/write",
    label: "Write content",
    description: "Replace all content in the selected file",
    insertText: "/write ",
  },
  {
    id: "ws-append",
    shortcut: "/append",
    label: "Append content",
    description: "Add text to the end of selected file",
    insertText: "/append ",
  },
  {
    id: "ws-replace",
    shortcut: "/replace",
    label: "Replace text",
    description: "Replace all matches using find and replace",
    insertText: "/replace  => ",
    cursorOffset: 4,
  },
  {
    id: "ws-help",
    shortcut: "/help",
    label: "Command help",
    description: "Show available workspace commands",
    insertText: "/help",
  },
];

const DEFAULT_GITHUB_MODEL = "";

const createMessageId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const formatConnectedAt = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Connected";
  }

  return `Connected ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
};

export default function AgentPanel({
  isOpen,
  onClose,
  activeFile,
  onOverwriteActiveFile,
  onAppendToActiveFile,
  onReplaceInActiveFile,
}: AgentPanelProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [providers, setProviders] = useState<AgentProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null,
  );
  const [messagesBySession, setMessagesBySession] = useState<
    Record<string, AgentChatMessage[]>
  >({});
  const [draftBySession, setDraftBySession] = useState<Record<string, string>>(
    {},
  );
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [sendingSessionId, setSendingSessionId] = useState<string | null>(null);
  const [thinkingPlanBySession, setThinkingPlanBySession] = useState<
    Record<string, string>
  >({});
  const [streamPreviewBySession, setStreamPreviewBySession] = useState<
    Record<string, string>
  >({});
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);
  const [pendingDeviceAuth, setPendingDeviceAuth] =
    useState<PendingDeviceAuth | null>(null);
  const [githubModelOptions, setGithubModelOptions] = useState<
    AgentModelOption[]
  >([]);
  const [isLoadingGithubModels, setIsLoadingGithubModels] = useState(false);
  const [githubModelsError, setGithubModelsError] = useState<string | null>(
    null,
  );
  const [selectedGithubModel, setSelectedGithubModel] =
    useState<string>(DEFAULT_GITHUB_MODEL);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const providerMenuRef = useRef<HTMLDivElement | null>(null);
  const devicePollTimerRef = useRef<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const currentSessionId = activeFile?.id ?? FALLBACK_FILE_SESSION_ID;
  const messages = useMemo(
    () => messagesBySession[currentSessionId] ?? EMPTY_SESSION_MESSAGES,
    [currentSessionId, messagesBySession],
  );
  const isThinkingInCurrentSession =
    isSendingMessage && sendingSessionId === currentSessionId;
  const activeThinkingPlan = thinkingPlanBySession[currentSessionId] ?? "";
  const activeStreamPreview = streamPreviewBySession[currentSessionId] ?? "";
  const draftMessage = draftBySession[currentSessionId] ?? "";

  const appendSessionMessage = useCallback(
    (sessionId: string, message: AgentChatMessage) => {
      setMessagesBySession((previous) => ({
        ...previous,
        [sessionId]: [...(previous[sessionId] ?? []), message],
      }));
    },
    [],
  );

  const setDraftForSession = useCallback((sessionId: string, value: string) => {
    setDraftBySession((previous) => ({
      ...previous,
      [sessionId]: value,
    }));
  }, []);

  const clearThinkingStateForSession = useCallback((sessionId: string) => {
    setThinkingPlanBySession((previous) => {
      if (!(sessionId in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[sessionId];
      return next;
    });

    setStreamPreviewBySession((previous) => {
      if (!(sessionId in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[sessionId];
      return next;
    });
  }, []);

  const clearDevicePollTimer = useCallback(() => {
    if (devicePollTimerRef.current === null) {
      return;
    }
    window.clearTimeout(devicePollTimerRef.current);
    devicePollTimerRef.current = null;
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId),
    [providers, selectedProviderId],
  );
  const isGithubProviderSelected = selectedProvider?.id === GITHUB_PROVIDER_ID;

  const filteredWorkspaceSuggestions = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) {
      return WORKSPACE_COMMAND_SUGGESTIONS;
    }

    return WORKSPACE_COMMAND_SUGGESTIONS.filter((item) => {
      return (
        item.shortcut.slice(1).toLowerCase().includes(query) ||
        item.label.toLowerCase().includes(query)
      );
    });
  }, [commandQuery]);

  const evaluateSlashComposerTrigger = useCallback(
    (value: string, cursorPosition: number) => {
      const beforeCursor = value.slice(0, cursorPosition);
      const triggerMatch = beforeCursor.match(/(^|\s)\/([^\s/]*)$/);
      if (!triggerMatch) {
        setIsCommandMenuOpen(false);
        setCommandQuery("");
        setActiveCommandIndex(0);
        return;
      }

      setCommandQuery(triggerMatch[2] ?? "");
      setActiveCommandIndex(0);
      setIsCommandMenuOpen(true);
    },
    [],
  );

  const applySlashSuggestion = useCallback(
    (suggestion: WorkspaceCommandSuggestion) => {
      const composer = composerRef.current;
      if (!composer) {
        return;
      }

      const selectionStart = composer.selectionStart ?? draftMessage.length;
      const selectionEnd = composer.selectionEnd ?? selectionStart;
      const beforeCursor = draftMessage.slice(0, selectionStart);
      const triggerMatch = beforeCursor.match(/(^|\s)\/([^\s/]*)$/);
      if (!triggerMatch || triggerMatch.index === undefined) {
        return;
      }

      const leadingWhitespace = triggerMatch[1] ?? "";
      const triggerStart = triggerMatch.index + leadingWhitespace.length;
      const nextDraft =
        draftMessage.slice(0, triggerStart) +
        suggestion.insertText +
        draftMessage.slice(selectionEnd);

      setDraftForSession(currentSessionId, nextDraft);
      setIsCommandMenuOpen(false);
      setCommandQuery("");

      const nextCursorPosition =
        triggerStart +
        suggestion.insertText.length -
        (suggestion.cursorOffset ?? 0);

      window.requestAnimationFrame(() => {
        composer.focus();
        composer.setSelectionRange(nextCursorPosition, nextCursorPosition);
      });
    },
    [currentSessionId, draftMessage, setDraftForSession],
  );

  const loadProviders = useCallback(async () => {
    setIsLoadingProviders(true);
    setProvidersError(null);

    try {
      const response = await fetch("/api/oauth/providers", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        providers?: AgentProvider[];
        error?: string;
      };

      if (!response.ok || !payload.providers) {
        throw new Error(payload.error ?? "Failed to fetch provider list.");
      }

      setProviders(payload.providers);
      setSelectedProviderId((previous) => {
        if (
          previous &&
          payload.providers?.some((item) => item.id === previous)
        ) {
          return previous;
        }
        const connectedProvider = payload.providers?.find(
          (item) => item.connected,
        )?.id;
        return connectedProvider ?? payload.providers?.[0]?.id ?? null;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch providers.";
      setProvidersError(message);
    } finally {
      setIsLoadingProviders(false);
    }
  }, []);

  const loadGithubModels = useCallback(async () => {
    setIsLoadingGithubModels(true);
    setGithubModelsError(null);

    try {
      const response = await fetch(
        "/api/agent/models?providerId=github-copilot",
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as AgentModelListResponse;

      if (!response.ok || !payload.models) {
        throw new Error(payload.error ?? "Failed to fetch GitHub model list.");
      }

      setGithubModelOptions(payload.models);
      setSelectedGithubModel((previous) => {
        if (payload.models?.some((model) => model.value === previous)) {
          return previous;
        }
        return payload.models?.[0]?.value ?? "";
      });
      setGithubModelsError(
        payload.error ??
          (payload.models.length === 0
            ? "No GitHub Copilot models available for this account."
            : null),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to fetch GitHub model list.";
      setGithubModelsError(message);
      setGithubModelOptions([]);
      setSelectedGithubModel("");
    } finally {
      setIsLoadingGithubModels(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadProviders();
  }, [isOpen, loadProviders]);

  useEffect(() => {
    if (!isOpen || !isGithubProviderSelected) {
      return;
    }

    void loadGithubModels();
  }, [isGithubProviderSelected, isOpen, loadGithubModels]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const oauthState = url.searchParams.get("oauth");
    if (!oauthState) {
      return;
    }

    const provider = url.searchParams.get("provider") ?? "provider";
    const reason = url.searchParams.get("message") ?? "";

    if (oauthState === "connected") {
      clearDevicePollTimer();
      setPendingDeviceAuth(null);
      setIsActionPending(false);
      setOauthNotice(`OAuth connected: ${provider}.`);
    } else {
      clearDevicePollTimer();
      setPendingDeviceAuth(null);
      setIsActionPending(false);
      setOauthNotice(
        `OAuth failed for ${provider}${reason ? ` (${reason})` : ""}.`,
      );
    }

    url.searchParams.delete("oauth");
    url.searchParams.delete("provider");
    url.searchParams.delete("message");
    window.history.replaceState({}, "", url.toString());
  }, [clearDevicePollTimer]);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, [isThinkingInCurrentSession, messages]);

  useEffect(() => {
    if (!isProviderMenuOpen) {
      return;
    }

    const handleOutsideMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (providerMenuRef.current?.contains(target)) {
        return;
      }
      setIsProviderMenuOpen(false);
    };

    window.addEventListener("mousedown", handleOutsideMouseDown);
    return () => {
      window.removeEventListener("mousedown", handleOutsideMouseDown);
    };
  }, [isProviderMenuOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      clearDevicePollTimer();
    };
  }, [clearDevicePollTimer]);

  useEffect(() => {
    if (!pendingDeviceAuth) {
      return;
    }

    let isDisposed = false;

    const schedulePoll = (seconds: number) => {
      const timeoutSeconds =
        Number.isFinite(seconds) && seconds > 0 ? seconds : 5;
      clearDevicePollTimer();
      devicePollTimerRef.current = window.setTimeout(() => {
        if (!isDisposed) {
          void pollDeviceAuthorization();
        }
      }, timeoutSeconds * 1000);
    };

    const pollDeviceAuthorization = async () => {
      if (Date.now() >= pendingDeviceAuth.expiresAt) {
        clearDevicePollTimer();
        setPendingDeviceAuth(null);
        setIsActionPending(false);
        setProvidersError("Device code expired. Click Connect OAuth again.");
        return;
      }

      try {
        const response = await fetch("/api/oauth/device/poll", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ providerId: pendingDeviceAuth.providerId }),
        });

        const payload = (await response.json()) as DevicePollResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? "Device authorization failed.");
        }

        if (payload.connected) {
          clearDevicePollTimer();
          setPendingDeviceAuth(null);
          setIsActionPending(false);
          setOauthNotice(`OAuth connected: ${pendingDeviceAuth.providerId}.`);
          await loadProviders();
          return;
        }

        if (payload.pending) {
          const retryAfter =
            typeof payload.retryAfterSeconds === "number"
              ? payload.retryAfterSeconds
              : pendingDeviceAuth.intervalSeconds;
          schedulePoll(retryAfter);
          return;
        }

        throw new Error("Unexpected device polling response.");
      } catch (error) {
        clearDevicePollTimer();
        setPendingDeviceAuth(null);
        setIsActionPending(false);
        const message =
          error instanceof Error
            ? error.message
            : "Device authorization failed.";
        setProvidersError(message);
      }
    };

    schedulePoll(pendingDeviceAuth.intervalSeconds);

    return () => {
      isDisposed = true;
      clearDevicePollTimer();
    };
  }, [clearDevicePollTimer, loadProviders, pendingDeviceAuth]);

  if (!isMounted) {
    return null;
  }

  const connectViaOAuth = async (providerId: string) => {
    setChatError(null);
    setProvidersError(null);
    setPendingDeviceAuth(null);
    clearDevicePollTimer();
    setIsActionPending(true);

    try {
      const response = await fetch("/api/oauth/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ providerId }),
      });

      const payload = (await response.json()) as OAuthConnectResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "OAuth connect failed.");
      }

      if (payload.flow === "device_code") {
        if (!payload.userCode || !payload.verificationUri) {
          throw new Error("Device flow response is incomplete.");
        }

        const intervalSeconds =
          typeof payload.intervalSeconds === "number" &&
          payload.intervalSeconds > 0
            ? payload.intervalSeconds
            : 5;
        const expiresIn =
          typeof payload.expiresIn === "number" && payload.expiresIn > 0
            ? payload.expiresIn
            : 900;
        const nextPending: PendingDeviceAuth = {
          providerId,
          userCode: payload.userCode,
          verificationUri: payload.verificationUri,
          verificationUriComplete: payload.verificationUriComplete,
          intervalSeconds,
          expiresAt: Date.now() + expiresIn * 1000,
        };

        setPendingDeviceAuth(nextPending);
        setOauthNotice(
          "Open GitHub verification, enter the code, and wait here.",
        );
        setIsActionPending(true);

        return;
      }

      if (!payload.authorizationUrl) {
        throw new Error("OAuth authorization URL is missing.");
      }

      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "OAuth connect failed.";
      setProvidersError(message);
      setIsActionPending(false);
    }
  };

  const disconnectProvider = async (providerId: string) => {
    setChatError(null);
    setProvidersError(null);
    setPendingDeviceAuth(null);
    clearDevicePollTimer();
    setIsActionPending(true);
    try {
      const response = await fetch("/api/oauth/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ providerId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to disconnect account.");
      }

      await loadProviders();
      setOauthNotice("Provider disconnected.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to disconnect.";
      setProvidersError(message);
    } finally {
      setIsActionPending(false);
    }
  };

  const applyWorkspaceActions = (
    fileId: string,
    fileLabel: string,
    actions: AgentWorkspaceAction[],
  ): string[] => {
    const results: string[] = [];

    for (const action of actions) {
      if (action.kind === "write") {
        const didWrite = onOverwriteActiveFile(fileId, action.content);
        results.push(
          didWrite
            ? `Wrote ${action.content.length} characters to ${fileLabel}.`
            : `Failed to write ${fileLabel}.`,
        );
        continue;
      }

      if (action.kind === "append") {
        const didAppend = onAppendToActiveFile(fileId, action.content);
        results.push(
          didAppend
            ? `Appended ${action.content.length} characters to ${fileLabel}.`
            : `Failed to append content to ${fileLabel}.`,
        );
        continue;
      }

      if (!action.find) {
        results.push("Skipped replace action because find text is empty.");
        continue;
      }

      const replacementCount = onReplaceInActiveFile(
        fileId,
        action.find,
        action.replaceWith,
      );
      results.push(
        replacementCount > 0
          ? `Updated ${fileLabel}. Replaced ${replacementCount} occurrence(s).`
          : `No match for "${action.find}" in ${fileLabel}.`,
      );
    }

    return results;
  };

  const sendMessage = async () => {
    const sessionId = currentSessionId;
    const activeSessionFile = activeFile?.id === sessionId ? activeFile : null;
    const sessionMessages = messagesBySession[sessionId] ?? [];

    const content = draftMessage.trim();
    if (!content) {
      return;
    }

    const workspaceCommand = parseWorkspaceCommand(content);
    if (workspaceCommand) {
      setChatError(null);
      setDraftForSession(sessionId, "");

      appendSessionMessage(sessionId, {
        id: createMessageId(),
        role: "user",
        providerLabel: WORKSPACE_TOOL_LABEL,
        content,
      });

      let responseText = "";
      if (workspaceCommand.kind === "help") {
        responseText = getWorkspaceHelpText();
      } else if (!activeSessionFile) {
        responseText =
          "No active file. Select a note tab first, then run workspace commands.";
      } else {
        switch (workspaceCommand.kind) {
          case "format": {
            const didFormat = onOverwriteActiveFile(
              activeSessionFile.id,
              activeSessionFile.content,
            );
            responseText = didFormat
              ? `Formatted ${activeSessionFile.title} with Typst-first normalization.`
              : "Failed to format active file.";
            break;
          }
          case "read": {
            responseText = [
              `Reading ${activeSessionFile.title}:`,
              "",
              activeSessionFile.content || "(File is empty)",
            ].join("\n");
            break;
          }
          case "write": {
            const didWrite = onOverwriteActiveFile(
              activeSessionFile.id,
              workspaceCommand.content,
            );
            responseText = didWrite
              ? `Wrote ${workspaceCommand.content.length} characters to ${activeSessionFile.title}.`
              : "Failed to write file content.";
            break;
          }
          case "append": {
            const didAppend = onAppendToActiveFile(
              activeSessionFile.id,
              workspaceCommand.content,
            );
            responseText = didAppend
              ? `Appended ${workspaceCommand.content.length} characters to ${activeSessionFile.title}.`
              : "Failed to append content.";
            break;
          }
          case "replace": {
            if (!workspaceCommand.find) {
              responseText =
                "Replace command failed: find text cannot be empty.";
              break;
            }

            const replacementCount = onReplaceInActiveFile(
              activeSessionFile.id,
              workspaceCommand.find,
              workspaceCommand.replaceWith,
            );
            responseText =
              replacementCount > 0
                ? `Updated ${activeSessionFile.title}. Replaced ${replacementCount} occurrence(s).`
                : `No match for "${workspaceCommand.find}" in ${activeSessionFile.title}.`;
            break;
          }
        }
      }

      appendSessionMessage(sessionId, {
        id: createMessageId(),
        role: "assistant",
        providerLabel: WORKSPACE_TOOL_LABEL,
        content: responseText,
      });
      setIsCommandMenuOpen(false);
      setCommandQuery("");
      setActiveCommandIndex(0);
      return;
    }

    if (!selectedProvider) {
      setChatError("Select a provider first.");
      return;
    }

    if (!selectedProvider.chatReady) {
      setChatError(
        "Provider belum siap chat. Connect OAuth dulu, atau set server token jika tersedia.",
      );
      return;
    }

    setChatError(null);
    setDraftForSession(sessionId, "");
    setIsCommandMenuOpen(false);
    setCommandQuery("");
    setActiveCommandIndex(0);
    setIsSendingMessage(true);
    setSendingSessionId(sessionId);
    setThinkingPlanBySession((previous) => ({
      ...previous,
      [sessionId]: "",
    }));
    setStreamPreviewBySession((previous) => ({
      ...previous,
      [sessionId]: "",
    }));

    const userMessage: AgentChatMessage = {
      id: createMessageId(),
      role: "user",
      providerLabel: selectedProvider.label,
      content,
    };

    appendSessionMessage(sessionId, userMessage);

    const history = sessionMessages
      .filter((message) => message.providerLabel !== WORKSPACE_TOOL_LABEL)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerId: selectedProvider.id,
          message: content,
          history,
          sessionId,
          workspace: activeSessionFile
            ? {
                title: activeSessionFile.title,
                content: activeSessionFile.content,
              }
            : undefined,
          model:
            isGithubProviderSelected && selectedGithubModel
              ? selectedGithubModel
              : undefined,
          stream: true,
        }),
      });

      const payload = await (async (): Promise<AgentChatResponse> => {
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/x-ndjson") || !response.body) {
          return (await response.json()) as AgentChatResponse;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let donePayload: AgentChatResponse | null = null;
        let streamError: string | null = null;

        const handleEvent = (event: AgentChatStreamEvent) => {
          switch (event.type) {
            case "plan": {
              if (typeof event.plan === "string") {
                const planText = event.plan.trim();
                setThinkingPlanBySession((previous) => ({
                  ...previous,
                  [sessionId]: planText,
                }));
              }
              break;
            }
            case "delta": {
              if (typeof event.delta === "string" && event.delta.length > 0) {
                const deltaText = event.delta;
                setStreamPreviewBySession((previous) => ({
                  ...previous,
                  [sessionId]: `${previous[sessionId] ?? ""}${deltaText}`,
                }));
              }
              break;
            }
            case "done": {
              donePayload = {
                providerLabel:
                  typeof event.providerLabel === "string"
                    ? event.providerLabel
                    : selectedProvider.label,
                message: typeof event.message === "string" ? event.message : "",
                workspaceActions: Array.isArray(event.workspaceActions)
                  ? event.workspaceActions
                  : [],
              };
              break;
            }
            case "error": {
              streamError =
                typeof event.error === "string" && event.error.trim().length > 0
                  ? event.error
                  : "Failed to send message.";
              break;
            }
          }
        };

        const processLines = (rawChunk: string) => {
          buffer += rawChunk;
          let newlineIndex = buffer.indexOf("\n");

          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            newlineIndex = buffer.indexOf("\n");

            if (!line) {
              continue;
            }

            try {
              const event = JSON.parse(line) as AgentChatStreamEvent;
              if (
                typeof event === "object" &&
                event !== null &&
                "type" in event
              ) {
                handleEvent(event);
              }
            } catch {
              continue;
            }
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          processLines(decoder.decode(value, { stream: true }));
        }

        processLines(decoder.decode());

        const trailingLine = buffer.trim();
        if (trailingLine) {
          try {
            const event = JSON.parse(trailingLine) as AgentChatStreamEvent;
            if (
              typeof event === "object" &&
              event !== null &&
              "type" in event
            ) {
              handleEvent(event);
            }
          } catch {
            // Ignore malformed trailing payload.
          }
        }

        if (!response.ok) {
          throw new Error(streamError ?? "Failed to send message.");
        }

        if (streamError) {
          throw new Error(streamError);
        }

        if (donePayload) {
          return donePayload;
        }

        throw new Error("Stream ended before assistant response was ready.");
      })();

      if (
        !response.ok ||
        (!payload.message && (payload.workspaceActions?.length ?? 0) === 0)
      ) {
        throw new Error(payload.error ?? "Failed to send message.");
      }

      const assistantContent = payload.message ?? "Workspace updated.";
      const returnedActions = payload.workspaceActions ?? [];
      const actionNotes =
        returnedActions.length > 0
          ? sessionId === FALLBACK_FILE_SESSION_ID
            ? ["No active file in this session. Workspace actions skipped."]
            : applyWorkspaceActions(
                sessionId,
                activeSessionFile?.title ?? `file ${sessionId}`,
                returnedActions,
              )
          : [];

      const assistantMessage: AgentChatMessage = {
        id: createMessageId(),
        role: "assistant",
        providerLabel: payload.providerLabel ?? selectedProvider.label,
        content:
          actionNotes.length > 0
            ? `${assistantContent}\n\n${actionNotes.join("\n")}`
            : assistantContent,
      };

      appendSessionMessage(sessionId, assistantMessage);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send message.";
      setChatError(message);
    } finally {
      setIsSendingMessage(false);
      setSendingSessionId(null);
      clearThinkingStateForSession(sessionId);
    }
  };

  const handleComposerKeyDown = (
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (isCommandMenuOpen && filteredWorkspaceSuggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveCommandIndex((current) => {
          return current === filteredWorkspaceSuggestions.length - 1
            ? 0
            : current + 1;
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCommandIndex((current) => {
          return current === 0
            ? filteredWorkspaceSuggestions.length - 1
            : current - 1;
        });
        return;
      }

      if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault();
        const selected = filteredWorkspaceSuggestions[activeCommandIndex];
        if (selected) {
          applySlashSuggestion(selected);
        }
        return;
      }
    }

    if (event.key === "Escape" && isCommandMenuOpen) {
      event.preventDefault();
      setIsCommandMenuOpen(false);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return createPortal(
    <>
      <aside
        className={isOpen ? "agent-panel agent-panel-open" : "agent-panel"}
      >
        <header className="agent-panel-head">
          <h3 className="agent-panel-title">Agent Panel</h3>
          <div className="agent-panel-menu-wrap" ref={providerMenuRef}>
            <button
              type="button"
              className="agent-panel-menu-toggle"
              onClick={() => setIsProviderMenuOpen((value) => !value)}
              aria-label="OAuth provider menu"
              aria-expanded={isProviderMenuOpen}
              aria-controls="agent-provider-menu"
            >
              <Ellipsis size={16} aria-hidden />
            </button>

            {isProviderMenuOpen && (
              <div id="agent-provider-menu" className="agent-provider-menu">
                <div className="agent-provider-menu-head">
                  <span>Connect OAuth Provider</span>
                  <button
                    type="button"
                    className="agent-inline-action"
                    onClick={() => void loadProviders()}
                    disabled={isLoadingProviders || isActionPending}
                  >
                    Refresh
                  </button>
                </div>

                {oauthNotice && (
                  <p className="agent-inline-notice">{oauthNotice}</p>
                )}
                {providersError && (
                  <p className="agent-inline-error">{providersError}</p>
                )}

                {pendingDeviceAuth && (
                  <div className="agent-device-card">
                    <p className="agent-device-title">GitHub Device Login</p>
                    <p className="agent-device-copy">
                      Open{" "}
                      <a
                        href={
                          pendingDeviceAuth.verificationUriComplete ??
                          pendingDeviceAuth.verificationUri
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        {pendingDeviceAuth.verificationUri}
                      </a>{" "}
                      then enter this code:
                    </p>
                    <p className="agent-device-code">
                      {pendingDeviceAuth.userCode}
                    </p>
                  </div>
                )}

                <div className="agent-provider-menu-list">
                  {providers.map((provider) => {
                    const isSelected = provider.id === selectedProviderId;
                    const isPendingDeviceAuth =
                      pendingDeviceAuth?.providerId === provider.id;
                    return (
                      <article
                        key={provider.id}
                        className="agent-menu-provider"
                      >
                        <button
                          type="button"
                          className={
                            isSelected
                              ? "agent-menu-provider-main agent-menu-provider-main-active"
                              : "agent-menu-provider-main"
                          }
                          onClick={() => setSelectedProviderId(provider.id)}
                        >
                          <span>{provider.label}</span>
                          <span>
                            {provider.connected ? "Connected" : "Disconnected"}
                          </span>
                        </button>

                        <div className="agent-provider-meta">
                          {provider.connected && provider.connection ? (
                            <span>
                              {provider.connection.accountLabel} ·{" "}
                              {formatConnectedAt(
                                provider.connection.connectedAt,
                              )}
                            </span>
                          ) : isPendingDeviceAuth ? (
                            <span>Waiting for GitHub code verification.</span>
                          ) : provider.configured ? (
                            <span>Ready for OAuth flow.</span>
                          ) : (
                            <span>OAuth env not configured yet.</span>
                          )}
                        </div>

                        <div className="agent-provider-actions">
                          {provider.connected ? (
                            <button
                              type="button"
                              className="agent-provider-action agent-provider-action-muted"
                              onClick={() =>
                                void disconnectProvider(provider.id)
                              }
                              disabled={isActionPending}
                            >
                              <Unplug size={14} aria-hidden />
                              Disconnect
                            </button>
                          ) : provider.configured ? (
                            <button
                              type="button"
                              className="agent-provider-action"
                              onClick={() => void connectViaOAuth(provider.id)}
                              disabled={isActionPending}
                            >
                              {isActionPending ? (
                                <Loader2
                                  size={14}
                                  className="spin"
                                  aria-hidden
                                />
                              ) : (
                                <Sparkles size={14} aria-hidden />
                              )}
                              Connect OAuth
                            </button>
                          ) : (
                            <span className="agent-provider-disabled-note">
                              OAuth env not configured yet.
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {isLoadingProviders && (
                  <div className="agent-provider-loading">
                    <Loader2 size={14} className="spin" aria-hidden />
                    Loading providers...
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="agent-panel-body">
          <div className="agent-chat-box">
            <div className="agent-section-head">
              <span className="agent-section-title">Chat</span>
              <span className="agent-chat-provider-pill">
                {selectedProvider
                  ? `Provider: ${selectedProvider.label}`
                  : "Provider: No provider"}
              </span>
            </div>

            <div className="agent-file-session-row">
              <span className="agent-file-session-label">Session file</span>
              <span className="agent-file-session-value">
                {activeFile?.title ?? "No open file"}
              </span>
            </div>

            <div className="agent-chat-thread" ref={messagesViewportRef}>
              {messages.length === 0 && (
                <div className="agent-chat-empty">
                  Use `/help` for workspace commands. Each open file has its own
                  isolated chat session.
                </div>
              )}

              {messages.map((message) => {
                const prefix = message.role === "assistant" ? ">" : ".";
                return (
                  <p
                    key={message.id}
                    className={
                      message.role === "assistant"
                        ? "agent-chat-line agent-chat-line-assistant"
                        : "agent-chat-line agent-chat-line-user"
                    }
                  >
                    <span className="agent-chat-prefix">{prefix}</span>
                    {message.content}
                  </p>
                );
              })}

              {isThinkingInCurrentSession && (
                <>
                  <p
                    className="agent-chat-line agent-chat-line-assistant agent-chat-line-thinking"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="agent-chat-prefix">{">"}</span>
                    <span className="agent-thinking-text">
                      Thinking
                      <span className="agent-thinking-dots" aria-hidden>
                        <span />
                        <span />
                        <span />
                      </span>
                    </span>
                  </p>

                  {activeThinkingPlan && (
                    <p className="agent-chat-line agent-chat-line-thinking-plan">
                      <span className="agent-chat-prefix">~</span>
                      {activeThinkingPlan}
                    </p>
                  )}

                  {activeStreamPreview && (
                    <p className="agent-chat-line agent-chat-line-thinking-preview">
                      <span className="agent-chat-prefix">{">"}</span>
                      {activeStreamPreview}
                    </p>
                  )}
                </>
              )}
            </div>

            {chatError && <p className="agent-inline-error">{chatError}</p>}

            <div className="agent-chat-compose-wrap">
              {isCommandMenuOpen && (
                <section
                  className="agent-command-menu"
                  aria-label="Workspace slash commands"
                >
                  <div className="agent-command-menu-head">
                    Workspace commands
                  </div>
                  <div className="agent-command-menu-list">
                    {filteredWorkspaceSuggestions.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        className={
                          index === activeCommandIndex
                            ? "agent-command-item agent-command-item-active"
                            : "agent-command-item"
                        }
                        onMouseEnter={() => setActiveCommandIndex(index)}
                        onClick={() => applySlashSuggestion(item)}
                      >
                        <span className="agent-command-shortcut">
                          {item.shortcut}
                        </span>
                        <span className="agent-command-label">
                          {item.label}
                        </span>
                        <span className="agent-command-description">
                          {item.description}
                        </span>
                      </button>
                    ))}
                    {filteredWorkspaceSuggestions.length === 0 && (
                      <div className="agent-command-empty">
                        No command found.
                      </div>
                    )}
                  </div>
                  <div className="agent-command-menu-foot">
                    Use arrow keys + Enter
                  </div>
                </section>
              )}

              <div className="agent-chat-compose">
                <textarea
                  ref={composerRef}
                  className="agent-chat-input"
                  placeholder="Type prompt or /format /read /write /append /replace"
                  value={draftMessage}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setDraftForSession(currentSessionId, nextValue);
                    evaluateSlashComposerTrigger(
                      nextValue,
                      event.target.selectionStart ?? nextValue.length,
                    );
                  }}
                  onClick={(event) => {
                    const element = event.currentTarget;
                    evaluateSlashComposerTrigger(
                      element.value,
                      element.selectionStart ?? element.value.length,
                    );
                  }}
                  onKeyUp={(event) => {
                    if (
                      event.key === "ArrowDown" ||
                      event.key === "ArrowUp" ||
                      event.key === "Enter" ||
                      event.key === "Tab"
                    ) {
                      return;
                    }
                    const element = event.currentTarget;
                    evaluateSlashComposerTrigger(
                      element.value,
                      element.selectionStart ?? element.value.length,
                    );
                  }}
                  onKeyDown={handleComposerKeyDown}
                />
                <button
                  type="button"
                  className="agent-chat-send"
                  onClick={() => void sendMessage()}
                  disabled={isSendingMessage}
                  aria-label="Send message"
                >
                  {isSendingMessage ? (
                    <Loader2 size={15} className="spin" aria-hidden />
                  ) : (
                    <SendHorizontal size={15} aria-hidden />
                  )}
                </button>
              </div>

              {isGithubProviderSelected && (
                <div className="agent-model-row">
                  <span className="agent-model-label">
                    Model (via GitHub Copilot)
                  </span>
                  {githubModelOptions.length > 0 ? (
                    <select
                      id="github-model"
                      className="agent-model-select"
                      value={selectedGithubModel}
                      onChange={(event) =>
                        setSelectedGithubModel(event.target.value)
                      }
                    >
                      {githubModelOptions.map((model: AgentModelOption) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="agent-model-hint">
                      No models available
                    </span>
                  )}
                  {isLoadingGithubModels && (
                    <span className="agent-model-hint">Loading...</span>
                  )}
                </div>
              )}

              {isGithubProviderSelected && githubModelsError && (
                <p className="agent-inline-error">{githubModelsError}</p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>,
    document.body,
  );
}
