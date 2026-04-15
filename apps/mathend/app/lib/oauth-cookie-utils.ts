import { isAgentProviderId, type AgentProviderId } from "./agent-providers";
import type {
  OAuthDevicePayload,
  OAuthConnection,
  OAuthConnectionMap,
  OAuthStatePayload,
  OAuthTokenMap,
  OAuthTokenSet,
} from "./oauth-types";

const MAX_STATE_AGE_MS = 10 * 60 * 1000;
const MAX_DEVICE_AGE_MS = 10 * 60 * 1000;

export const parseOAuthConnections = (
  raw: string | undefined,
): OAuthConnectionMap => {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    const entries = Object.entries(parsed as Record<string, unknown>);
    const next: OAuthConnectionMap = {};

    for (const [providerId, value] of entries) {
      if (!isAgentProviderId(providerId)) {
        continue;
      }

      if (typeof value !== "object" || value === null) {
        continue;
      }

      const candidate = value as Partial<OAuthConnection>;
      if (
        candidate.providerId !== providerId ||
        typeof candidate.providerLabel !== "string" ||
        typeof candidate.accountLabel !== "string" ||
        typeof candidate.connectedAt !== "string" ||
        candidate.mode !== "oauth"
      ) {
        continue;
      }

      next[providerId] = {
        providerId,
        providerLabel: candidate.providerLabel,
        accountLabel: candidate.accountLabel,
        connectedAt: candidate.connectedAt,
        mode: candidate.mode,
      };
    }

    return next;
  } catch {
    return {};
  }
};

export const serializeOAuthConnections = (map: OAuthConnectionMap): string => {
  return JSON.stringify(map);
};

export const parseOAuthStatePayload = (
  raw: string | undefined,
): OAuthStatePayload | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const candidate = parsed as Partial<OAuthStatePayload>;
    if (
      !candidate.providerId ||
      !isAgentProviderId(candidate.providerId) ||
      typeof candidate.state !== "string" ||
      typeof candidate.createdAt !== "number"
    ) {
      return null;
    }

    if (
      candidate.codeVerifier !== undefined &&
      typeof candidate.codeVerifier !== "string"
    ) {
      return null;
    }

    return {
      providerId: candidate.providerId,
      state: candidate.state,
      codeVerifier: candidate.codeVerifier,
      createdAt: candidate.createdAt,
    };
  } catch {
    return null;
  }
};

export const serializeOAuthStatePayload = (
  payload: OAuthStatePayload,
): string => {
  return JSON.stringify(payload);
};

export const parseOAuthDevicePayload = (
  raw: string | undefined,
): OAuthDevicePayload | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const candidate = parsed as Partial<OAuthDevicePayload>;
    if (
      !candidate.providerId ||
      !isAgentProviderId(candidate.providerId) ||
      typeof candidate.deviceCode !== "string" ||
      candidate.deviceCode.length === 0 ||
      typeof candidate.userCode !== "string" ||
      candidate.userCode.length === 0 ||
      typeof candidate.verificationUri !== "string" ||
      candidate.verificationUri.length === 0 ||
      typeof candidate.createdAt !== "number" ||
      typeof candidate.expiresAt !== "number" ||
      typeof candidate.intervalSeconds !== "number"
    ) {
      return null;
    }

    if (
      candidate.verificationUriComplete !== undefined &&
      typeof candidate.verificationUriComplete !== "string"
    ) {
      return null;
    }

    return {
      providerId: candidate.providerId,
      deviceCode: candidate.deviceCode,
      userCode: candidate.userCode,
      verificationUri: candidate.verificationUri,
      verificationUriComplete: candidate.verificationUriComplete,
      createdAt: candidate.createdAt,
      expiresAt: candidate.expiresAt,
      intervalSeconds: candidate.intervalSeconds,
    };
  } catch {
    return null;
  }
};

export const serializeOAuthDevicePayload = (
  payload: OAuthDevicePayload,
): string => {
  return JSON.stringify(payload);
};

export const isOAuthStateFresh = (payload: OAuthStatePayload): boolean => {
  return Date.now() - payload.createdAt <= MAX_STATE_AGE_MS;
};

export const isOAuthDeviceFresh = (payload: OAuthDevicePayload): boolean => {
  const maxAge = payload.expiresAt - payload.createdAt;
  const allowedAge =
    Number.isFinite(maxAge) && maxAge > 0 ? maxAge : MAX_DEVICE_AGE_MS;
  return Date.now() - payload.createdAt <= Math.max(allowedAge, 1000);
};

export const removeOAuthConnection = (
  map: OAuthConnectionMap,
  providerId: AgentProviderId,
): OAuthConnectionMap => {
  const next = { ...map };
  delete next[providerId];
  return next;
};

export const parseOAuthTokens = (raw: string | undefined): OAuthTokenMap => {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    const entries = Object.entries(parsed as Record<string, unknown>);
    const next: OAuthTokenMap = {};

    for (const [providerId, value] of entries) {
      if (!isAgentProviderId(providerId)) {
        continue;
      }

      if (typeof value !== "object" || value === null) {
        continue;
      }

      const candidate = value as Partial<OAuthTokenSet>;
      if (
        typeof candidate.accessToken !== "string" ||
        candidate.accessToken.length === 0 ||
        typeof candidate.tokenType !== "string" ||
        candidate.tokenType.length === 0 ||
        typeof candidate.updatedAt !== "string"
      ) {
        continue;
      }

      if (
        candidate.expiresAt !== undefined &&
        typeof candidate.expiresAt !== "string"
      ) {
        continue;
      }

      if (
        candidate.copilotAccessToken !== undefined &&
        typeof candidate.copilotAccessToken !== "string"
      ) {
        continue;
      }

      if (
        candidate.copilotExpiresAt !== undefined &&
        typeof candidate.copilotExpiresAt !== "string"
      ) {
        continue;
      }

      if (
        candidate.copilotRefreshAfter !== undefined &&
        typeof candidate.copilotRefreshAfter !== "string"
      ) {
        continue;
      }

      next[providerId] = {
        accessToken: candidate.accessToken,
        tokenType: candidate.tokenType,
        scope: candidate.scope,
        refreshToken: candidate.refreshToken,
        idToken: candidate.idToken,
        expiresAt: candidate.expiresAt,
        copilotAccessToken: candidate.copilotAccessToken,
        copilotExpiresAt: candidate.copilotExpiresAt,
        copilotRefreshAfter: candidate.copilotRefreshAfter,
        updatedAt: candidate.updatedAt,
      };
    }

    return next;
  } catch {
    return {};
  }
};

export const serializeOAuthTokens = (map: OAuthTokenMap): string => {
  return JSON.stringify(map);
};

export const removeOAuthToken = (
  map: OAuthTokenMap,
  providerId: AgentProviderId,
): OAuthTokenMap => {
  const next = { ...map };
  delete next[providerId];
  return next;
};
