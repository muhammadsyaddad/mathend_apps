import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isOAuthStateFresh,
  parseOAuthConnections,
  parseOAuthTokens,
  parseOAuthStatePayload,
  serializeOAuthConnections,
  serializeOAuthTokens,
} from "../../../../lib/oauth-cookie-utils";
import {
  getOAuthProviderRuntimeConfig,
  isOAuthProviderConfigured,
  resolveAgentProviderId,
} from "../../../../lib/oauth-provider-runtime";
import {
  OAUTH_CONNECTIONS_COOKIE,
  OAUTH_DEVICE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_TOKENS_COOKIE,
  type OAuthConnection,
  type OAuthTokenSet,
} from "../../../../lib/oauth-types";

type OAuthTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
};

const withOAuthParams = (
  request: Request,
  params: Record<string, string>,
): URL => {
  const url = new URL("/", request.url);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url;
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
    };
  }
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

type CallbackContext = {
  params: Promise<{ providerId: string }>;
};

export async function GET(request: Request, context: CallbackContext) {
  const { providerId: providerIdParam } = await context.params;
  const providerId = resolveAgentProviderId(providerIdParam);

  if (!providerId) {
    return NextResponse.redirect(
      withOAuthParams(request, {
        oauth: "error",
        message: "unknown_provider",
      }),
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(
      withOAuthParams(request, {
        oauth: "error",
        provider: providerId,
        message: "missing_code_or_state",
      }),
    );
  }

  const cookieStore = await cookies();
  const statePayload = parseOAuthStatePayload(
    cookieStore.get(OAUTH_STATE_COOKIE)?.value,
  );
  if (
    !statePayload ||
    statePayload.providerId !== providerId ||
    statePayload.state !== state ||
    !isOAuthStateFresh(statePayload)
  ) {
    const invalidStateResponse = NextResponse.redirect(
      withOAuthParams(request, {
        oauth: "error",
        provider: providerId,
        message: "invalid_or_expired_state",
      }),
    );
    invalidStateResponse.cookies.set({
      name: OAUTH_STATE_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
    });
    return invalidStateResponse;
  }

  const config = getOAuthProviderRuntimeConfig(providerId);
  if (!isOAuthProviderConfigured(config)) {
    return NextResponse.redirect(
      withOAuthParams(request, {
        oauth: "error",
        provider: providerId,
        message: "provider_not_configured",
      }),
    );
  }

  const redirectUri = `${url.origin}/api/oauth/callback/${providerId}`;
  const tokenRequestBody = new URLSearchParams();
  tokenRequestBody.set("grant_type", "authorization_code");
  tokenRequestBody.set("code", code);
  tokenRequestBody.set("redirect_uri", redirectUri);
  tokenRequestBody.set("client_id", config.clientId);

  if (providerId === "github-copilot") {
    tokenRequestBody.set("client_secret", config.clientSecret);
  } else {
    if (!statePayload.codeVerifier) {
      return NextResponse.redirect(
        withOAuthParams(request, {
          oauth: "error",
          provider: providerId,
          message: "missing_code_verifier",
        }),
      );
    }
    tokenRequestBody.set("code_verifier", statePayload.codeVerifier);
    tokenRequestBody.set("client_secret", config.clientSecret);
  }

  let tokenPayload: OAuthTokenResponse;
  try {
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenRequestBody,
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(
        withOAuthParams(request, {
          oauth: "error",
          provider: providerId,
          message: "token_exchange_failed",
        }),
      );
    }

    tokenPayload = await parseTokenResponse(tokenResponse);
  } catch {
    return NextResponse.redirect(
      withOAuthParams(request, {
        oauth: "error",
        provider: providerId,
        message: "token_exchange_request_failed",
      }),
    );
  }

  const accessToken = tokenPayload.access_token;
  if (!accessToken) {
    return NextResponse.redirect(
      withOAuthParams(request, {
        oauth: "error",
        provider: providerId,
        message: "missing_access_token",
      }),
    );
  }

  const accountLabel = await resolveAccountLabel(
    config.profileUrl,
    accessToken,
  );
  const connection: OAuthConnection = {
    providerId,
    providerLabel: config.providerLabel,
    accountLabel,
    connectedAt: new Date().toISOString(),
    mode: "oauth",
  };

  const connectionMap = parseOAuthConnections(
    cookieStore.get(OAUTH_CONNECTIONS_COOKIE)?.value,
  );
  connectionMap[providerId] = connection;

  const tokenMap = parseOAuthTokens(
    cookieStore.get(OAUTH_TOKENS_COOKIE)?.value,
  );
  const tokenSet: OAuthTokenSet = {
    accessToken,
    tokenType: tokenPayload.token_type ?? "Bearer",
    scope: tokenPayload.scope,
    refreshToken: tokenPayload.refresh_token,
    idToken: tokenPayload.id_token,
    expiresAt:
      typeof tokenPayload.expires_in === "number" && tokenPayload.expires_in > 0
        ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
        : undefined,
    updatedAt: new Date().toISOString(),
  };
  tokenMap[providerId] = tokenSet;

  const successResponse = NextResponse.redirect(
    withOAuthParams(request, {
      oauth: "connected",
      provider: providerId,
    }),
  );

  successResponse.cookies.set({
    name: OAUTH_CONNECTIONS_COOKIE,
    value: serializeOAuthConnections(connectionMap),
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  successResponse.cookies.set({
    name: OAUTH_TOKENS_COOKIE,
    value: serializeOAuthTokens(tokenMap),
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  successResponse.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });

  successResponse.cookies.set({
    name: OAUTH_DEVICE_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });

  return successResponse;
}
