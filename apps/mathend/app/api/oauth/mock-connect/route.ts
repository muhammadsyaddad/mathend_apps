import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAgentProviderLabel,
  isAgentProviderId,
  type AgentProviderId,
} from "../../../lib/agent-providers";
import {
  parseOAuthConnections,
  parseOAuthTokens,
  serializeOAuthConnections,
  serializeOAuthTokens,
} from "../../../lib/oauth-cookie-utils";
import {
  OAUTH_CONNECTIONS_COOKIE,
  OAUTH_DEVICE_COOKIE,
  OAUTH_TOKENS_COOKIE,
  type OAuthConnection,
  type OAuthTokenSet,
} from "../../../lib/oauth-types";

type MockConnectBody = {
  providerId?: string;
  accountLabel?: string;
};

const defaultAccountByProvider: Record<AgentProviderId, string> = {
  "github-copilot": "copilot-demo-user",
  "claude-code": "claude-demo-user",
};

export async function POST(request: Request) {
  let body: MockConnectBody;
  try {
    body = (await request.json()) as MockConnectBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 },
    );
  }

  const providerId = body.providerId;
  if (!providerId || !isAgentProviderId(providerId)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  }

  const normalizedAccount = (body.accountLabel ?? "").trim();
  const accountLabel =
    normalizedAccount || defaultAccountByProvider[providerId] || "demo-user";

  const cookieStore = await cookies();
  const connectionMap = parseOAuthConnections(
    cookieStore.get(OAUTH_CONNECTIONS_COOKIE)?.value,
  );

  const connection: OAuthConnection = {
    providerId,
    providerLabel: getAgentProviderLabel(providerId),
    accountLabel,
    connectedAt: new Date().toISOString(),
    mode: "mock",
  };

  connectionMap[providerId] = connection;

  const tokenMap = parseOAuthTokens(
    cookieStore.get(OAUTH_TOKENS_COOKIE)?.value,
  );
  const tokenSet: OAuthTokenSet = {
    accessToken: `mock-token-${providerId}-${Date.now()}`,
    tokenType: "Bearer",
    scope: "mock",
    updatedAt: new Date().toISOString(),
  };
  tokenMap[providerId] = tokenSet;

  const response = NextResponse.json({ ok: true, connection });
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

  response.cookies.set({
    name: OAUTH_DEVICE_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });

  return response;
}
