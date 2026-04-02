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
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
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
          content:
            "You are a concise math assistant. Give clear, structured reasoning.",
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
      system:
        "You are a concise math assistant. Give clear, structured reasoning.",
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
      history,
    );
  }

  return requestOpenAICompatible(
    config,
    providerId,
    accessToken,
    message,
    modelOverride,
    history,
  );
};
