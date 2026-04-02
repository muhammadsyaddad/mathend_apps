import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requestAgentLiveChat } from "../../../lib/agent-chat-live";
import { createMockAgentResponse } from "../../../lib/agent-chat";
import { isAgentProviderId } from "../../../lib/agent-providers";
import {
  parseOAuthConnections,
  parseOAuthTokens,
} from "../../../lib/oauth-cookie-utils";
import {
  OAUTH_CONNECTIONS_COOKIE,
  OAUTH_TOKENS_COOKIE,
} from "../../../lib/oauth-types";

type AgentChatRequestBody = {
  providerId?: string;
  message?: string;
  model?: string;
};

export async function POST(request: Request) {
  let body: AgentChatRequestBody;
  try {
    body = (await request.json()) as AgentChatRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 },
    );
  }

  const providerId = body.providerId;
  const message = (body.message ?? "").trim();
  const model = (body.model ?? "").trim();

  if (!providerId || !isAgentProviderId(providerId)) {
    return NextResponse.json(
      { error: "Unknown agent provider." },
      { status: 400 },
    );
  }

  if (!message) {
    return NextResponse.json(
      { error: "Message cannot be empty." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const connectionMap = parseOAuthConnections(
    cookieStore.get(OAUTH_CONNECTIONS_COOKIE)?.value,
  );
  const connection = connectionMap[providerId];
  if (!connection) {
    return NextResponse.json(
      { error: "Provider is not connected via OAuth yet." },
      { status: 401 },
    );
  }

  const tokenMap = parseOAuthTokens(
    cookieStore.get(OAUTH_TOKENS_COOKIE)?.value,
  );
  const token = tokenMap[providerId];

  let responseText: string;
  if (token?.accessToken) {
    try {
      const liveText = await requestAgentLiveChat({
        providerId,
        accessToken: token.accessToken,
        message,
        modelOverride: model || undefined,
      });
      if (liveText) {
        responseText = liveText;
      } else {
        responseText = createMockAgentResponse({
          providerLabel: connection.providerLabel,
          message,
        });
      }
    } catch {
      responseText = createMockAgentResponse({
        providerLabel: connection.providerLabel,
        message,
      });
    }
  } else {
    responseText = createMockAgentResponse({
      providerLabel: connection.providerLabel,
      message,
    });
  }

  return NextResponse.json({
    role: "assistant",
    providerId,
    providerLabel: connection.providerLabel,
    message: responseText,
  });
}
