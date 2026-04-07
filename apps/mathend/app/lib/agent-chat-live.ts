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

const buildSystemPrompt = (workspace?: {
  fileTitle: string;
  fileContent: string;
}): string => {
  const instructions = [
    "You are an IDE-style assistant for Mathend notes workspace.",
    "Always reply as valid JSON only (no markdown fence) with this exact shape:",
    '{"reply":"string","workspaceActions":[{"kind":"write","content":"string"}|{"kind":"append","content":"string"}|{"kind":"replace","find":"string","replaceWith":"string"}]}',
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
    `<file title=\"${workspace.fileTitle}\">`,
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

  if (providerId === "github-copilot" && !candidate.includes("/")) {
    return `openai/${candidate}`;
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

const requestOpenAICompatible = async (
  config: AgentProviderChatRuntimeConfig,
  providerId: AgentProviderId,
  accessToken: string,
  message: string,
  modelOverride?: string,
  workspace?: {
    fileTitle: string;
    fileContent: string;
  },
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>,
): Promise<string> => {
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

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    body: JSON.stringify({
      model: modelWithPolicy,
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
  });

  const payload = await toJson(response);
  if (!response.ok) {
    throw new Error("Live chat request failed.");
  }

  const content =
    readOpenAIStyleMessage(payload) ?? readClaudeStyleMessage(payload);
  if (!content) {
    throw new Error("Live provider returned empty response.");
  }

  return content;
};

const requestClaudeCompatible = async (
  config: AgentProviderChatRuntimeConfig,
  providerId: AgentProviderId,
  accessToken: string,
  message: string,
  modelOverride?: string,
  workspace?: {
    fileTitle: string;
    fileContent: string;
  },
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>,
): Promise<string> => {
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

  const response = await fetch(config.endpoint, {
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
  });

  const payload = await toJson(response);
  if (!response.ok) {
    throw new Error("Live chat request failed.");
  }

  const content =
    readClaudeStyleMessage(payload) ?? readOpenAIStyleMessage(payload);
  if (!content) {
    throw new Error("Live provider returned empty response.");
  }

  return content;
};

export const requestAgentLiveChat = async ({
  providerId,
  accessToken,
  message,
  modelOverride,
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
    workspace,
    history,
  );
};
