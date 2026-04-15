import type { OAuthTokenSet } from "./oauth-types";

type CopilotTokenExchangeResult = {
  accessToken: string;
  cacheUpdate?: Pick<
    OAuthTokenSet,
    "copilotAccessToken" | "copilotExpiresAt" | "copilotRefreshAfter"
  >;
};

type CopilotTokenExchangeResponse = {
  token?: unknown;
  expires_at?: unknown;
  refresh_in?: unknown;
};

const DEFAULT_TOKEN_EXCHANGE_ENDPOINT =
  "https://api.github.com/copilot_internal/v2/token";
const USER_AGENT = "Mathend-Copilot-Bridge";

const memoryCache = new Map<
  string,
  {
    accessToken: string;
    expiresAtMs?: number;
    refreshAfterMs?: number;
  }
>();

const parsePositiveNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return 0;
};

const parseIsoDate = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }
  return timestamp;
};

const isStillValid = (
  nowMs: number,
  refreshAfterMs?: number,
  expiresAtMs?: number,
): boolean => {
  if (refreshAfterMs && nowMs >= refreshAfterMs) {
    return false;
  }
  if (expiresAtMs && nowMs >= expiresAtMs - 5_000) {
    return false;
  }
  return true;
};

const buildCacheUpdate = (
  accessToken: string,
  expiresAtMs?: number,
  refreshAfterMs?: number,
): Pick<
  OAuthTokenSet,
  "copilotAccessToken" | "copilotExpiresAt" | "copilotRefreshAfter"
> => {
  return {
    copilotAccessToken: accessToken,
    copilotExpiresAt: expiresAtMs
      ? new Date(expiresAtMs).toISOString()
      : undefined,
    copilotRefreshAfter: refreshAfterMs
      ? new Date(refreshAfterMs).toISOString()
      : undefined,
  };
};

export const resolveGitHubCopilotAccessToken = async (input: {
  oauthAccessToken: string;
  tokenSet?: OAuthTokenSet;
  tokenExchangeEndpoint?: string;
}): Promise<CopilotTokenExchangeResult> => {
  const oauthAccessToken = input.oauthAccessToken.trim();
  if (!oauthAccessToken) {
    throw new Error("Missing GitHub OAuth access token.");
  }

  const nowMs = Date.now();
  const cachedToken = input.tokenSet?.copilotAccessToken?.trim();
  if (cachedToken) {
    const refreshAfterMs = parseIsoDate(input.tokenSet?.copilotRefreshAfter);
    const expiresAtMs = parseIsoDate(input.tokenSet?.copilotExpiresAt);
    if (isStillValid(nowMs, refreshAfterMs, expiresAtMs)) {
      return { accessToken: cachedToken };
    }
  }

  const memoryCached = memoryCache.get(oauthAccessToken);
  if (
    memoryCached &&
    isStillValid(nowMs, memoryCached.refreshAfterMs, memoryCached.expiresAtMs)
  ) {
    return {
      accessToken: memoryCached.accessToken,
      cacheUpdate: buildCacheUpdate(
        memoryCached.accessToken,
        memoryCached.expiresAtMs,
        memoryCached.refreshAfterMs,
      ),
    };
  }

  const tokenExchangeEndpoint =
    (input.tokenExchangeEndpoint ?? "").trim() ||
    DEFAULT_TOKEN_EXCHANGE_ENDPOINT;

  let response: Response;
  try {
    response = await fetch(tokenExchangeEndpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${oauthAccessToken}`,
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
    });
  } catch {
    return { accessToken: oauthAccessToken };
  }

  let payload: CopilotTokenExchangeResponse;
  try {
    payload = (await response.json()) as CopilotTokenExchangeResponse;
  } catch {
    return { accessToken: oauthAccessToken };
  }

  if (!response.ok) {
    return { accessToken: oauthAccessToken };
  }

  const copilotToken =
    typeof payload.token === "string" ? payload.token.trim() : "";
  if (!copilotToken) {
    return { accessToken: oauthAccessToken };
  }

  const refreshInSeconds = parsePositiveNumber(payload.refresh_in);
  const expiresAtSeconds = parsePositiveNumber(payload.expires_at);
  const refreshAfterMs =
    refreshInSeconds > 0
      ? nowMs + Math.max(refreshInSeconds * 1000 - 10_000, 15_000)
      : undefined;
  const expiresAtMs =
    expiresAtSeconds > 0
      ? expiresAtSeconds * 1000
      : refreshInSeconds > 0
        ? nowMs + refreshInSeconds * 1000
        : undefined;

  memoryCache.set(oauthAccessToken, {
    accessToken: copilotToken,
    expiresAtMs,
    refreshAfterMs,
  });

  return {
    accessToken: copilotToken,
    cacheUpdate: buildCacheUpdate(copilotToken, expiresAtMs, refreshAfterMs),
  };
};
