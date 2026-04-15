import type { AgentProviderId } from "./agent-providers";

type AgentProviderChatRuntimeConfig = {
  providerId: AgentProviderId;
  model: string;
  endpoint: string;
  authMode: "oauth-token" | "static-token";
  staticToken?: string;
  staticOrg?: string;
  allowModelOverride?: boolean;
};

const readEnv = (name: string): string => process.env[name]?.trim() ?? "";

const readBoolEnv = (name: string, fallback = false): boolean => {
  const raw = readEnv(name).toLowerCase();
  if (!raw) {
    return fallback;
  }
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
};

export const getAgentProviderChatRuntimeConfig = (
  providerId: AgentProviderId,
): AgentProviderChatRuntimeConfig | null => {
  if (providerId === "github-copilot") {
    const endpoint =
      readEnv("MATHEND_GITHUB_COPILOT_CHAT_ENDPOINT") ||
      "https://api.githubcopilot.com/chat/completions";
    const model = readEnv("MATHEND_GITHUB_COPILOT_CHAT_MODEL") || "gpt-4o-mini";
    const allowOverride = readBoolEnv(
      "MATHEND_GITHUB_MODELS_ALLOW_BROWSER_MODEL_OVERRIDE",
      true,
    );

    const githubModelsPat = readEnv("MATHEND_GITHUB_MODELS_PAT");
    const githubModelsOrg = readEnv("MATHEND_GITHUB_MODELS_ORG");

    if (githubModelsPat) {
      return {
        providerId,
        endpoint: githubModelsOrg
          ? `https://models.github.ai/orgs/${githubModelsOrg}/inference/chat/completions`
          : "https://models.github.ai/inference/chat/completions",
        model: model.includes("/") ? model : `openai/${model}`,
        authMode: "static-token",
        staticToken: githubModelsPat,
        staticOrg: githubModelsOrg || undefined,
        allowModelOverride: allowOverride,
      };
    }

    return {
      providerId,
      endpoint,
      model,
      authMode: "oauth-token",
      allowModelOverride: allowOverride,
    };
  }

  const endpoint = readEnv("MATHEND_CLAUDE_CODE_CHAT_ENDPOINT");
  const model =
    readEnv("MATHEND_CLAUDE_CODE_CHAT_MODEL") || "claude-3-5-sonnet";
  if (!endpoint) {
    return null;
  }
  return {
    providerId,
    endpoint,
    model,
    authMode: "oauth-token",
  };
};

export type { AgentProviderChatRuntimeConfig };
