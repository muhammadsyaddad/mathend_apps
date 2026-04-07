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
  onOverwriteActiveFile: (nextContent: string) => boolean;
  onAppendToActiveFile: (appendContent: string) => boolean;
  onReplaceInActiveFile: (find: string, replaceWith: string) => number;
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
    "/read - show active file content",
    "/write <content> - replace active file with content",
    "/append <content> - append content at the end",
    "/replace <find> => <replace> - replace all matches",
    '/replace "find text" "replace text" - quoted variant',
  ].join("\n");
};

const WORKSPACE_COMMAND_SUGGESTIONS: WorkspaceCommandSuggestion[] = [
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

const GITHUB_MODEL_OPTIONS = [
  {
    label: "GPT-4o mini",
    value: "openai/gpt-4o-mini",
  },
  {
    label: "GPT-4.1",
    value: "openai/gpt-4.1",
  },
  {
    label: "GPT-4.1 mini",
    value: "openai/gpt-4.1-mini",
  },
  {
    label: "o4-mini",
    value: "openai/o4-mini",
  },
  {
    label: "gpt-5-chat",
    value: "openai/gpt-5-chat",
  },
] as const;

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
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);
  const [pendingDeviceAuth, setPendingDeviceAuth] =
    useState<PendingDeviceAuth | null>(null);
  const [selectedGithubModel, setSelectedGithubModel] = useState<string>(
    GITHUB_MODEL_OPTIONS[0].value,
  );
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const providerMenuRef = useRef<HTMLDivElement | null>(null);
  const devicePollTimerRef = useRef<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const currentSessionId = activeFile?.id ?? FALLBACK_FILE_SESSION_ID;
  const messages = useMemo(
    () => messagesBySession[currentSessionId] ?? EMPTY_SESSION_MESSAGES,
    [currentSessionId, messagesBySession],
  );
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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadProviders();
  }, [isOpen, loadProviders]);

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
  }, [messages]);

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

  const sendMessage = async () => {
    const sessionId = currentSessionId;
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
      } else if (!activeFile) {
        responseText =
          "No active file. Select a note tab first, then run workspace commands.";
      } else {
        switch (workspaceCommand.kind) {
          case "read": {
            responseText = [
              `Reading ${activeFile.title}:`,
              "",
              activeFile.content || "(File is empty)",
            ].join("\n");
            break;
          }
          case "write": {
            const didWrite = onOverwriteActiveFile(workspaceCommand.content);
            responseText = didWrite
              ? `Wrote ${workspaceCommand.content.length} characters to ${activeFile.title}.`
              : "Failed to write file content.";
            break;
          }
          case "append": {
            const didAppend = onAppendToActiveFile(workspaceCommand.content);
            responseText = didAppend
              ? `Appended ${workspaceCommand.content.length} characters to ${activeFile.title}.`
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
              workspaceCommand.find,
              workspaceCommand.replaceWith,
            );
            responseText =
              replacementCount > 0
                ? `Updated ${activeFile.title}. Replaced ${replacementCount} occurrence(s).`
                : `No match for "${workspaceCommand.find}" in ${activeFile.title}.`;
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

    if (!selectedProvider.connected) {
      setChatError("Connect provider via OAuth before chatting.");
      return;
    }

    setChatError(null);
    setDraftForSession(sessionId, "");
    setIsCommandMenuOpen(false);
    setCommandQuery("");
    setActiveCommandIndex(0);
    setIsSendingMessage(true);

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
          model:
            selectedProvider.id === "github-copilot"
              ? selectedGithubModel
              : undefined,
        }),
      });
      const payload = (await response.json()) as {
        providerLabel?: string;
        message?: string;
        error?: string;
      };

      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? "Failed to send message.");
      }

      const assistantMessage: AgentChatMessage = {
        id: createMessageId(),
        role: "assistant",
        providerLabel: payload.providerLabel ?? selectedProvider.label,
        content: payload.message,
      };

      appendSessionMessage(sessionId, assistantMessage);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send message.";
      setChatError(message);
    } finally {
      setIsSendingMessage(false);
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
                {selectedProvider?.label ?? "No provider"}
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
                  placeholder="Type prompt or /read /write /append /replace"
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

              {selectedProvider?.id === "github-copilot" && (
                <div className="agent-model-row">
                  <select
                    id="github-model"
                    className="agent-model-select"
                    value={selectedGithubModel}
                    onChange={(event) =>
                      setSelectedGithubModel(event.target.value)
                    }
                  >
                    {GITHUB_MODEL_OPTIONS.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>,
    document.body,
  );
}
