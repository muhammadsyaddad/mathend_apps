import type { AgentProviderId } from "./agent-providers";
import {
  getAgentProviderChatRuntimeConfig,
  type AgentProviderChatRuntimeConfig,
} from "./agent-provider-chat-runtime";

type LiveChatRequest = {
  providerId: AgentProviderId;
  accessToken: string;
  message: string;
  modelOverride?: string;
  onTextDelta?: (chunk: string) => void;
  workspace?: {
    fileTitle: string;
    fileContent: string;
  };
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

const MAX_WORKSPACE_PROMPT_CHARS = 12000;
const LIVE_CHAT_TIMEOUT_MS = 90000;

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  return error instanceof Error && error.name === "AbortError";
};

const emitTextDelta = (
  onTextDelta: ((chunk: string) => void) | undefined,
  chunk: string,
): void => {
  if (!onTextDelta || !chunk) {
    return;
  }

  try {
    onTextDelta(chunk);
  } catch {
    // Ignore callback failures to avoid breaking provider response handling.
  }
};

const normalizeCopilotModelId = (modelId: string): string => {
  const trimmed = modelId.trim();
  if (!trimmed) {
    return "";
  }

  const withoutPublisher = trimmed.replace(/^[^/]+\//, "");
  return withoutPublisher.trim();
};

const buildSystemPrompt = (workspace?: {
  fileTitle: string;
  fileContent: string;
}): string => {
  const instructions = [
    "You are an IDE-style assistant for Mathend notes workspace.",
    "Always reply as valid JSON only (no markdown fence) with this exact shape:",
    '{"reply":"string","workspaceActions":[{"kind":"write","content":"string"}|{"kind":"append","content":"string"}|{"kind":"replace","find":"string","replaceWith":"string"}]}',
    "Mathend uses Typst-first syntax in note content.",
    "Prefer Typst-friendly math forms: frac(a, b), sqrt(x), root(x, n), lim_(x->a), ∫, ∑, ∏.",
    "Avoid LaTeX-only wrappers such as \\[, \\], \\(, \\), $$, and raw \\frac in workspaceActions content.",
    "For derivations, structure output as: short context, numbered steps, one equation per line, final result.",
    "Use compact headings and consistent spacing so note output remains neat.",
    "If user does not ask to edit file content, return workspaceActions as [].",
    "If user asks to rewrite or generate complete note, prefer one write action with full final content.",
    "Keep reply concise and actionable.",
  ];

  if (!workspace) {
    return instructions.join("\n");
  }

  const trimmedContent = workspace.fileContent.slice(
    0,
    MAX_WORKSPACE_PROMPT_CHARS,
  );

  return [
    ...instructions,
    "Active file context:",
    `<file title="${workspace.fileTitle}">`,
    trimmedContent,
    "</file>",
  ].join("\n");
};

const resolveModel = (
  providerId: AgentProviderId,
  runtimeModel: string,
  allowModelOverride: boolean,
  modelOverride?: string,
): string => {
  if (!allowModelOverride) {
    return runtimeModel;
  }

  const candidate = (modelOverride ?? "").trim();
  if (!candidate) {
    return runtimeModel;
  }

  if (providerId === "github-copilot") {
    return candidate;
  }

  return candidate;
};

const toJson = async (response: Response): Promise<unknown> => {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { raw };
  }
};

const stringifyPayloadSnippet = (payload: unknown): string => {
  try {
    const text = JSON.stringify(payload);
    return text.length > 240 ? `${text.slice(0, 240)}...` : text;
  } catch {
    return "";
  }
};

const readProviderErrorDetail = (payload: unknown): string => {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }

  const candidate = payload as {
    error?: unknown;
    message?: unknown;
  };

  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message.trim();
  }

  if (typeof candidate.error === "string" && candidate.error.trim()) {
    return candidate.error.trim();
  }

  if (typeof candidate.error === "object" && candidate.error !== null) {
    const nested = candidate.error as {
      message?: unknown;
      code?: unknown;
      type?: unknown;
    };
    const nestedMessage =
      typeof nested.message === "string" ? nested.message.trim() : "";
    if (nestedMessage) {
      return nestedMessage;
    }

    const nestedCode = typeof nested.code === "string" ? nested.code : "";
    const nestedType = typeof nested.type === "string" ? nested.type : "";
    const compact = [nestedType, nestedCode].filter(Boolean).join("/");
    if (compact) {
      return compact;
    }
  }

  return stringifyPayloadSnippet(payload);
};

const fetchWithTimeout = async (
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const readOpenAIStyleMessage = (payload: unknown): string | null => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const candidate = payload as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = candidate.choices?.[0]?.message?.content;
  return typeof text === "string" && text.trim().length > 0 ? text : null;
};

const readClaudeStyleMessage = (payload: unknown): string | null => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const candidate = payload as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = candidate.content
    ?.filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text as string)
    .join("\n")
    .trim();
  return text ? text : null;
};

const readOpenAIStyleDelta = (payload: unknown): string | null => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const candidate = payload as {
    choices?: Array<{
      delta?: {
        content?:
          | string
          | Array<{
              type?: string;
              text?: string;
            }>;
      };
      text?: string;
    }>;
  };

  const choice = candidate.choices?.[0];
  if (!choice) {
    return null;
  }

  if (typeof choice.text === "string" && choice.text.length > 0) {
    return choice.text;
  }

  const deltaContent = choice.delta?.content;
  if (typeof deltaContent === "string" && deltaContent.length > 0) {
    return deltaContent;
  }

  if (Array.isArray(deltaContent)) {
    const text = deltaContent
      .filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text as string)
      .join("");

    if (text.length > 0) {
      return text;
    }
  }

  return null;
};

const readClaudeStyleDelta = (payload: unknown): string | null => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const candidate = payload as {
    type?: string;
    delta?: {
      type?: string;
      text?: string;
    };
    text?: string;
  };

  if (
    candidate.type === "content_block_delta" &&
    candidate.delta?.type === "text_delta" &&
    typeof candidate.delta.text === "string" &&
    candidate.delta.text.length > 0
  ) {
    return candidate.delta.text;
  }

  if (typeof candidate.text === "string" && candidate.text.length > 0) {
    return candidate.text;
  }

  if (
    typeof candidate.delta?.text === "string" &&
    candidate.delta.text.length > 0
  ) {
    return candidate.delta.text;
  }

  return null;
};

const readSseText = async (
  response: Response,
  readDelta: (payload: unknown) => string | null,
  onTextDelta?: (chunk: string) => void,
): Promise<string> => {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  const flushEventBlock = (rawBlock: string) => {
    const lines = rawBlock.split("\n");
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length === 0) {
      return;
    }

    const payloadText = dataLines.join("\n").trim();
    if (!payloadText || payloadText === "[DONE]") {
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(payloadText) as unknown;
    } catch {
      return;
    }

    const delta = readDelta(payload);
    if (!delta) {
      return;
    }

    fullText += delta;
    emitTextDelta(onTextDelta, delta);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");

    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary).replace(/\r/g, "");
      buffer = buffer.slice(boundary + 2);
      flushEventBlock(rawEvent);
      boundary = buffer.indexOf("\n\n");
    }
  }

  buffer += decoder.decode();
  const trailing = buffer.trim();
  if (trailing) {
    flushEventBlock(trailing.replace(/\r/g, ""));
  }

  return fullText;
};

const requestOpenAICompatible = async (
  config: AgentProviderChatRuntimeConfig,
  providerId: AgentProviderId,
  accessToken: string,
  message: string,
  modelOverride?: string,
  onTextDelta?: (chunk: string) => void,
  workspace?: {
    fileTitle: string;
    fileContent: string;
  },
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>,
): Promise<string> => {
  const shouldStream = Boolean(onTextDelta);
  const bearerToken =
    config.authMode === "static-token" && config.staticToken
      ? config.staticToken
      : accessToken;
  const modelWithPolicy = resolveModel(
    providerId,
    config.model,
    config.allowModelOverride ?? false,
    modelOverride,
  );
  const isCopilotApi =
    providerId === "github-copilot" &&
    config.endpoint.includes("api.githubcopilot.com");
  const normalizedModel = isCopilotApi
    ? normalizeCopilotModelId(modelWithPolicy)
    : providerId === "github-copilot" && !modelWithPolicy.includes("/")
      ? `openai/${modelWithPolicy}`
      : modelWithPolicy;

  let response: Response;
  try {
    response = await fetchWithTimeout(
      config.endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
          ...(isCopilotApi
            ? {
                Accept: "application/json",
                "User-Agent": "Mathend-Copilot-Bridge",
                "OpenAI-Intent": "conversation-edits",
                "x-initiator": "user",
              }
            : {
                Accept: shouldStream
                  ? "text/event-stream"
                  : "application/vnd.github+json",
                "X-GitHub-Api-Version": "2026-03-10",
              }),
        },
        body: JSON.stringify({
          model: normalizedModel,
          stream: shouldStream,
          messages: [
            {
              role: "system",
              content: buildSystemPrompt(workspace),
            },
            ...(history ?? []).map((item) => ({
              role: item.role,
              content: item.content,
            })),
            {
              role: "user",
              content: message,
            },
          ],
        }),
        cache: "no-store",
      },
      LIVE_CHAT_TIMEOUT_MS,
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        `Live chat request timed out after ${Math.floor(LIVE_CHAT_TIMEOUT_MS / 1000)}s.`,
      );
    }
    throw error;
  }

  const responseContentType = response.headers.get("content-type") ?? "";

  if (
    shouldStream &&
    response.ok &&
    responseContentType.includes("text/event-stream")
  ) {
    const streamedText = await readSseText(
      response,
      readOpenAIStyleDelta,
      onTextDelta,
    );
    if (streamedText.trim()) {
      return streamedText;
    }
  }

  const payload = await toJson(response);
  if (!response.ok) {
    const detail = readProviderErrorDetail(payload);
    const authHint =
      providerId === "github-copilot" &&
      (response.status === 401 || response.status === 403)
        ? " GitHub OAuth token may need reconnect to refresh Copilot entitlement."
        : "";
    throw new Error(
      `Live chat request failed (${response.status}).${detail ? ` ${detail}` : ""}${authHint}`,
    );
  }

  const content =
    readOpenAIStyleMessage(payload) ?? readClaudeStyleMessage(payload);
  if (!content) {
    throw new Error("Live provider returned empty response.");
  }

  emitTextDelta(onTextDelta, content);

  return content;
};

const requestClaudeCompatible = async (
  config: AgentProviderChatRuntimeConfig,
  providerId: AgentProviderId,
  accessToken: string,
  message: string,
  modelOverride?: string,
  onTextDelta?: (chunk: string) => void,
  workspace?: {
    fileTitle: string;
    fileContent: string;
  },
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>,
): Promise<string> => {
  const shouldStream = Boolean(onTextDelta);
  const bearerToken =
    config.authMode === "static-token" && config.staticToken
      ? config.staticToken
      : accessToken;
  const model = resolveModel(
    providerId,
    config.model,
    config.allowModelOverride ?? false,
    modelOverride,
  );

  let response: Response;
  try {
    response = await fetchWithTimeout(
      config.endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
          "x-api-key": bearerToken,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 700,
          stream: shouldStream,
          messages: [
            ...(history ?? []).map((item) => ({
              role: item.role,
              content: item.content,
            })),
            {
              role: "user",
              content: message,
            },
          ],
          system: buildSystemPrompt(workspace),
        }),
        cache: "no-store",
      },
      LIVE_CHAT_TIMEOUT_MS,
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        `Live chat request timed out after ${Math.floor(LIVE_CHAT_TIMEOUT_MS / 1000)}s.`,
      );
    }
    throw error;
  }

  const responseContentType = response.headers.get("content-type") ?? "";

  if (
    shouldStream &&
    response.ok &&
    responseContentType.includes("text/event-stream")
  ) {
    const streamedText = await readSseText(
      response,
      readClaudeStyleDelta,
      onTextDelta,
    );
    if (streamedText.trim()) {
      return streamedText;
    }
  }

  const payload = await toJson(response);
  if (!response.ok) {
    const detail = readProviderErrorDetail(payload);
    throw new Error(
      `Live chat request failed (${response.status}).${detail ? ` ${detail}` : ""}`,
    );
  }

  const content =
    readClaudeStyleMessage(payload) ?? readOpenAIStyleMessage(payload);
  if (!content) {
    throw new Error("Live provider returned empty response.");
  }

  emitTextDelta(onTextDelta, content);

  return content;
};

export const requestAgentLiveChat = async ({
  providerId,
  accessToken,
  message,
  modelOverride,
  onTextDelta,
  workspace,
  history,
}: LiveChatRequest): Promise<string | null> => {
  const config = getAgentProviderChatRuntimeConfig(providerId);
  if (!config) {
    return null;
  }

  if (providerId === "claude-code") {
    return requestClaudeCompatible(
      config,
      providerId,
      accessToken,
      message,
      modelOverride,
      onTextDelta,
      workspace,
      history,
    );
  }

  return requestOpenAICompatible(
    config,
    providerId,
    accessToken,
    message,
    modelOverride,
    onTextDelta,
    workspace,
    history,
  );
};
