import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createPkcePair, randomBase64Url } from "../../../lib/oauth-security";
import {
  getOAuthProviderRuntimeConfig,
  isOAuthProviderConfigured,
  resolveAgentProviderId,
} from "../../../lib/oauth-provider-runtime";
import {
  OAUTH_DEVICE_COOKIE,
  OAUTH_STATE_COOKIE,
  type OAuthDevicePayload,
  type OAuthStatePayload,
} from "../../../lib/oauth-types";
import {
  serializeOAuthDevicePayload,
  serializeOAuthStatePayload,
} from "../../../lib/oauth-cookie-utils";

type ConnectRequestBody = {
  providerId?: string;
};

type DeviceCodeResponse = {
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  expires_in?: number;
  interval?: number;
};

const parseDeviceCodeResponse = async (
  response: Response,
): Promise<DeviceCodeResponse> => {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as DeviceCodeResponse;
  } catch {
    const params = new URLSearchParams(raw);
    const expiresIn = Number(params.get("expires_in") ?? "0");
    const interval = Number(params.get("interval") ?? "0");
    return {
      device_code: params.get("device_code") ?? undefined,
      user_code: params.get("user_code") ?? undefined,
      verification_uri: params.get("verification_uri") ?? undefined,
      verification_uri_complete:
        params.get("verification_uri_complete") ?? undefined,
      expires_in: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 0,
      interval: Number.isFinite(interval) && interval > 0 ? interval : 0,
    };
  }
};

export async function POST(request: Request) {
  let body: ConnectRequestBody;
  try {
    body = (await request.json()) as ConnectRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 },
    );
  }

  const providerId = resolveAgentProviderId(body.providerId ?? "");
  if (!providerId) {
    return NextResponse.json(
      { error: "Unknown provider for OAuth connect." },
      { status: 400 },
    );
  }

  const config = getOAuthProviderRuntimeConfig(providerId);
  if (!isOAuthProviderConfigured(config)) {
    return NextResponse.json(
      {
        error: "OAuth provider is not configured. Set provider env vars first.",
      },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const callbackUrl = `${origin}/api/oauth/callback/${providerId}`;

  if (providerId === "github-copilot") {
    const deviceCodeUrl = config.deviceCodeUrl;
    if (!deviceCodeUrl) {
      return NextResponse.json(
        {
          error:
            "OAuth provider is not configured. Set GitHub device code URL env first.",
        },
        { status: 400 },
      );
    }

    const requestBody = new URLSearchParams();
    requestBody.set("client_id", config.clientId);
    requestBody.set("scope", config.scope);

    let payload: DeviceCodeResponse;
    try {
      const deviceResponse = await fetch(deviceCodeUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: requestBody,
        cache: "no-store",
      });

      if (!deviceResponse.ok) {
        return NextResponse.json(
          { error: "Failed to start GitHub device flow." },
          { status: 502 },
        );
      }

      payload = await parseDeviceCodeResponse(deviceResponse);
    } catch {
      return NextResponse.json(
        { error: "Failed to reach GitHub OAuth device endpoint." },
        { status: 502 },
      );
    }

    const deviceCode = payload.device_code;
    const userCode = payload.user_code;
    const verificationUri = payload.verification_uri;
    if (!deviceCode || !userCode || !verificationUri) {
      return NextResponse.json(
        { error: "GitHub device flow returned incomplete payload." },
        { status: 502 },
      );
    }

    const intervalSeconds =
      typeof payload.interval === "number" && payload.interval > 0
        ? payload.interval
        : 5;
    const expiresIn =
      typeof payload.expires_in === "number" && payload.expires_in > 0
        ? payload.expires_in
        : 900;

    const createdAt = Date.now();
    const devicePayload: OAuthDevicePayload = {
      providerId,
      deviceCode,
      userCode,
      verificationUri,
      verificationUriComplete: payload.verification_uri_complete,
      createdAt,
      expiresAt: createdAt + expiresIn * 1000,
      intervalSeconds,
    };

    const response = NextResponse.json({
      flow: "device_code",
      verificationUri,
      verificationUriComplete: payload.verification_uri_complete,
      userCode,
      intervalSeconds,
      expiresIn,
    });

    const cookieStore = await cookies();
    cookieStore.set({
      name: OAUTH_DEVICE_COOKIE,
      value: serializeOAuthDevicePayload(devicePayload),
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(expiresIn, 60),
    });

    return response;
  }

  const state = randomBase64Url(24);
  const pkcePair = await createPkcePair();
  const codeVerifier = pkcePair.codeVerifier;
  const codeChallenge = pkcePair.codeChallenge;

  const payload: OAuthStatePayload = {
    providerId,
    state,
    codeVerifier,
    createdAt: Date.now(),
  };

  const authorizeUrl = new URL(config.authUrl);
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", config.scope);
  authorizeUrl.searchParams.set("state", state);

  if (codeChallenge) {
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
  }

  const response = NextResponse.json({
    flow: "authorization_code",
    authorizationUrl: authorizeUrl.toString(),
  });

  const cookieStore = await cookies();
  cookieStore.set({
    name: OAUTH_STATE_COOKIE,
    value: serializeOAuthStatePayload(payload),
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
