import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AGENT_PROVIDER_CATALOG } from "../../../lib/agent-providers";
import { getAgentProviderChatRuntimeConfig } from "../../../lib/agent-provider-chat-runtime";
import { parseOAuthConnections } from "../../../lib/oauth-cookie-utils";
import {
  getOAuthProviderRuntimeConfig,
  isOAuthProviderConfigured,
} from "../../../lib/oauth-provider-runtime";
import { OAUTH_CONNECTIONS_COOKIE } from "../../../lib/oauth-types";

export async function GET() {
  const cookieStore = await cookies();
  const connectionMap = parseOAuthConnections(
    cookieStore.get(OAUTH_CONNECTIONS_COOKIE)?.value,
  );

  const providers = AGENT_PROVIDER_CATALOG.map((provider) => {
    const runtime = getOAuthProviderRuntimeConfig(provider.id);
    const chatRuntime = getAgentProviderChatRuntimeConfig(provider.id);
    const connection = connectionMap[provider.id];
    const hasServerTokenChat =
      chatRuntime?.authMode === "static-token" &&
      Boolean(chatRuntime.staticToken);

    return {
      id: provider.id,
      label: provider.label,
      configured: isOAuthProviderConfigured(runtime),
      connected: Boolean(connection),
      chatReady: Boolean(connection) || hasServerTokenChat,
      connection,
    };
  });

  return NextResponse.json({ providers });
}
