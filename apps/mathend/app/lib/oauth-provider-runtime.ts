import {
  getAgentProviderLabel,
  isAgentProviderId,
  type AgentProviderId,
} from "./agent-providers";

type OAuthProviderRuntimeConfig = {
  providerId: AgentProviderId;
  providerLabel: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  deviceCodeUrl?: string;
  scope: string;
  profileUrl?: string;
};

const readEnv = (name: string): string => process.env[name]?.trim() ?? "";

const getGitHubCopilotConfig = (): OAuthProviderRuntimeConfig => {
  return {
    providerId: "github-copilot",
    providerLabel: getAgentProviderLabel("github-copilot"),
    clientId: readEnv("MATHEND_GITHUB_COPILOT_CLIENT_ID"),
    clientSecret: readEnv("MATHEND_GITHUB_COPILOT_CLIENT_SECRET"),
    authUrl:
      readEnv("MATHEND_GITHUB_COPILOT_AUTH_URL") ||
      "https://github.com/login/oauth/authorize",
    tokenUrl:
      readEnv("MATHEND_GITHUB_COPILOT_TOKEN_URL") ||
      "https://github.com/login/oauth/access_token",
    deviceCodeUrl:
      readEnv("MATHEND_GITHUB_COPILOT_DEVICE_CODE_URL") ||
      "https://github.com/login/device/code",
    scope: readEnv("MATHEND_GITHUB_COPILOT_SCOPE") || "read:user user:email",
    profileUrl:
      readEnv("MATHEND_GITHUB_COPILOT_PROFILE_URL") ||
      "https://api.github.com/user",
  };
};

const getClaudeCodeConfig = (): OAuthProviderRuntimeConfig => {
  return {
    providerId: "claude-code",
    providerLabel: getAgentProviderLabel("claude-code"),
    clientId: readEnv("MATHEND_CLAUDE_CODE_CLIENT_ID"),
    clientSecret: readEnv("MATHEND_CLAUDE_CODE_CLIENT_SECRET"),
    authUrl: readEnv("MATHEND_CLAUDE_CODE_AUTH_URL"),
    tokenUrl: readEnv("MATHEND_CLAUDE_CODE_TOKEN_URL"),
    scope: readEnv("MATHEND_CLAUDE_CODE_SCOPE") || "openid profile",
    profileUrl: readEnv("MATHEND_CLAUDE_CODE_PROFILE_URL") || undefined,
  };
};

export const getOAuthProviderRuntimeConfig = (
  providerId: AgentProviderId,
): OAuthProviderRuntimeConfig => {
  if (providerId === "github-copilot") {
    return getGitHubCopilotConfig();
  }
  return getClaudeCodeConfig();
};

export const resolveAgentProviderId = (
  input: string,
): AgentProviderId | null => {
  return isAgentProviderId(input) ? input : null;
};

export const isOAuthProviderConfigured = (
  config: OAuthProviderRuntimeConfig,
): boolean => {
  if (config.providerId === "github-copilot") {
    return (
      config.clientId.length > 0 &&
      config.tokenUrl.length > 0 &&
      (config.deviceCodeUrl?.length ?? 0) > 0
    );
  }

  return (
    config.clientId.length > 0 &&
    config.clientSecret.length > 0 &&
    config.authUrl.length > 0 &&
    config.tokenUrl.length > 0
  );
};

export type { OAuthProviderRuntimeConfig };
