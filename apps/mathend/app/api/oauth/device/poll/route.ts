import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isOAuthDeviceFresh,
  parseOAuthConnections,
  parseOAuthDevicePayload,
  parseOAuthTokens,
  serializeOAuthConnections,
  serializeOAuthTokens,
} from "../../../../lib/oauth-cookie-utils";
import {
  getOAuthProviderRuntimeConfig,
  isOAuthProviderConfigured,
} from "../../../../lib/oauth-provider-runtime";
import {
  OAUTH_CONNECTIONS_COOKIE,
  OAUTH_DEVICE_COOKIE,
  OAUTH_TOKENS_COOKIE,
  type OAuthConnection,
  type OAuthTokenSet,
} from "../../../../lib/oauth-types";

type PollRequestBody = {
  providerId?: string;
};

type OAuthTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  error?: string;
};

const clearDeviceCookie = (response: NextResponse): void => {
  response.cookies.set({
    name: OAUTH_DEVICE_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
};

const parseTokenResponse = async (
  response: Response,
): Promise<OAuthTokenResponse> => {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as OAuthTokenResponse;
  } catch {
    const entries = new URLSearchParams(raw);
    return {
      access_token: entries.get("access_token") ?? undefined,
      token_type: entries.get("token_type") ?? undefined,
      scope: entries.get("scope") ?? undefined,
      id_token: entries.get("id_token") ?? undefined,
      refresh_token: entries.get("refresh_token") ?? undefined,
      expires_in: entries.get("expires_in") ?? undefined,
      error: entries.get("error") ?? undefined,
    };
  }
};

const parsePositiveNumber = (value: number | string | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return 0;
};

const resolveAccountLabel = async (
  profileUrl: string | undefined,
  accessToken: string,
): Promise<string> => {
  if (!profileUrl) {
    return "Connected Account";
  }

  try {
    const response = await fetch(profileUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "User-Agent": "Mathend-OAuth-Client",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return "Connected Account";
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const login = payload.login;
    const name = payload.name;
    const email = payload.email;

    if (typeof login === "string" && login.length > 0) {
      return login;
    }
    if (typeof name === "string" && name.length > 0) {
      return name;
    }
    if (typeof email === "string" && email.length > 0) {
      return email;
    }
    return "Connected Account";
  } catch {
    return "Connected Account";
  }
};

export async function POST(request: Request) {
  let body: PollRequestBody;
  try {
    body = (await request.json()) as PollRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const devicePayload = parseOAuthDevicePayload(
    cookieStore.get(OAUTH_DEVICE_COOKIE)?.value,
  );

  if (!devicePayload) {
    return NextResponse.json(
      { error: "No pending device authorization." },
      { status: 400 },
    );
  }

  if (body.providerId && body.providerId !== devicePayload.providerId) {
    return NextResponse.json(
      { error: "Provider mismatch for pending authorization." },
      { status: 400 },
    );
  }

  if (!isOAuthDeviceFresh(devicePayload)) {
    const expiredResponse = NextResponse.json(
      { error: "Device code expired. Start connect again." },
      { status: 400 },
    );
    clearDeviceCookie(expiredResponse);
    return expiredResponse;
  }

  const config = getOAuthProviderRuntimeConfig(devicePayload.providerId);
  if (!isOAuthProviderConfigured(config)) {
    return NextResponse.json(
      { error: "OAuth provider is not configured." },
      { status: 400 },
    );
  }

  const tokenRequestBody = new URLSearchParams();
  tokenRequestBody.set("client_id", config.clientId);
  tokenRequestBody.set("device_code", devicePayload.deviceCode);
  tokenRequestBody.set(
    "grant_type",
    "urn:ietf:params:oauth:grant-type:device_code",
  );

  let tokenResponse: Response;
  let tokenPayload: OAuthTokenResponse;
  try {
    tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenRequestBody,
      cache: "no-store",
    });
    tokenPayload = await parseTokenResponse(tokenResponse);
  } catch {
    return NextResponse.json(
      { error: "Failed to poll OAuth token endpoint." },
      { status: 502 },
    );
  }

  const errorCode = (tokenPayload.error ?? "").trim();
  if (errorCode === "authorization_pending") {
    return NextResponse.json({
      pending: true,
      retryAfterSeconds: devicePayload.intervalSeconds,
    });
  }

  if (errorCode === "slow_down") {
    return NextResponse.json({
      pending: true,
      retryAfterSeconds: devicePayload.intervalSeconds + 5,
    });
  }

  if (
    errorCode === "expired_token" ||
    errorCode === "access_denied" ||
    errorCode === "incorrect_device_code"
  ) {
    const deniedResponse = NextResponse.json(
      { error: "Device authorization failed. Start connect again." },
      { status: 400 },
    );
    clearDeviceCookie(deniedResponse);
    return deniedResponse;
  }

  const accessToken = tokenPayload.access_token;
  if (!tokenResponse.ok || !accessToken) {
    return NextResponse.json(
      { error: "Token exchange failed for device authorization." },
      { status: 502 },
    );
  }

  const accountLabel = await resolveAccountLabel(
    config.profileUrl,
    accessToken,
  );
  const connection: OAuthConnection = {
    providerId: devicePayload.providerId,
    providerLabel: config.providerLabel,
    accountLabel,
    connectedAt: new Date().toISOString(),
    mode: "oauth",
  };

  const connectionMap = parseOAuthConnections(
    cookieStore.get(OAUTH_CONNECTIONS_COOKIE)?.value,
  );
  connectionMap[devicePayload.providerId] = connection;

  const tokenMap = parseOAuthTokens(
    cookieStore.get(OAUTH_TOKENS_COOKIE)?.value,
  );
  const expiresIn = parsePositiveNumber(tokenPayload.expires_in);
  const tokenSet: OAuthTokenSet = {
    accessToken,
    tokenType: tokenPayload.token_type ?? "Bearer",
    scope: tokenPayload.scope,
    refreshToken: tokenPayload.refresh_token,
    idToken: tokenPayload.id_token,
    expiresAt:
      expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : undefined,
    updatedAt: new Date().toISOString(),
  };
  tokenMap[devicePayload.providerId] = tokenSet;

  const response = NextResponse.json({
    connected: true,
    providerId: devicePayload.providerId,
  });

  response.cookies.set({
    name: OAUTH_CONNECTIONS_COOKIE,
    value: serializeOAuthConnections(connectionMap),
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  response.cookies.set({
    name: OAUTH_TOKENS_COOKIE,
    value: serializeOAuthTokens(tokenMap),
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  clearDeviceCookie(response);

  return response;
}
