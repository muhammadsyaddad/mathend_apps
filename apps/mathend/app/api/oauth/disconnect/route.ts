import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAgentProviderId } from "../../../lib/agent-providers";
import {
  parseOAuthConnections,
  parseOAuthTokens,
  removeOAuthConnection,
  removeOAuthToken,
  serializeOAuthConnections,
  serializeOAuthTokens,
} from "../../../lib/oauth-cookie-utils";
import {
  OAUTH_CONNECTIONS_COOKIE,
  OAUTH_DEVICE_COOKIE,
  OAUTH_TOKENS_COOKIE,
} from "../../../lib/oauth-types";

type DisconnectBody = {
  providerId?: string;
};

export async function POST(request: Request) {
  let body: DisconnectBody;
  try {
    body = (await request.json()) as DisconnectBody;
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

  const cookieStore = await cookies();
  const connectionMap = parseOAuthConnections(
    cookieStore.get(OAUTH_CONNECTIONS_COOKIE)?.value,
  );
  const nextMap = removeOAuthConnection(connectionMap, providerId);
  const tokenMap = parseOAuthTokens(
    cookieStore.get(OAUTH_TOKENS_COOKIE)?.value,
  );
  const nextTokenMap = removeOAuthToken(tokenMap, providerId);

  const response = NextResponse.json({ ok: true, providerId });
  response.cookies.set({
    name: OAUTH_CONNECTIONS_COOKIE,
    value: serializeOAuthConnections(nextMap),
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  response.cookies.set({
    name: OAUTH_TOKENS_COOKIE,
    value: serializeOAuthTokens(nextTokenMap),
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
