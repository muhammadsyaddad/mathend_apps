import type { AgentProviderId } from "./agent-providers";

export const OAUTH_CONNECTIONS_COOKIE = "mathend.oauth.connections.v1";
export const OAUTH_STATE_COOKIE = "mathend.oauth.state.v1";
export const OAUTH_TOKENS_COOKIE = "mathend.oauth.tokens.v1";
export const OAUTH_DEVICE_COOKIE = "mathend.oauth.device.v1";

export type OAuthConnection = {
  providerId: AgentProviderId;
  providerLabel: string;
  accountLabel: string;
  connectedAt: string;
  mode: "oauth";
};

export type OAuthConnectionMap = Partial<
  Record<AgentProviderId, OAuthConnection>
>;

export type OAuthStatePayload = {
  providerId: AgentProviderId;
  state: string;
  codeVerifier?: string;
  createdAt: number;
};

export type OAuthDevicePayload = {
  providerId: AgentProviderId;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  createdAt: number;
  expiresAt: number;
  intervalSeconds: number;
};

export type OAuthTokenSet = {
  accessToken: string;
  tokenType: string;
  scope?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: string;
  updatedAt: string;
};

export type OAuthTokenMap = Partial<Record<AgentProviderId, OAuthTokenSet>>;
