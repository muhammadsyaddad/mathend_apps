import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requestAgentLiveChat } from "../../../lib/agent-chat-live";
import { createMockAgentResponse } from "../../../lib/agent-chat";
import { isAgentProviderId } from "../../../lib/agent-providers";
import { getAgentProviderChatRuntimeConfig } from "../../../lib/agent-provider-chat-runtime";
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
  sessionId?: string;
  workspace?: {
    title?: string;
    content?: string;
  };
  history?: Array<{
    role?: "user" | "assistant";
    content?: string;
  }>;
};

type AgentWorkspaceAction =
  | {
      kind: "write";
      content: string;
    }
  | {
      kind: "append";
      content: string;
    }
  | {
      kind: "replace";
      find: string;
      replaceWith: string;
    };

const normalizeRawAssistantPayload = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return trimmed;
};

const parseWorkspaceActions = (input: unknown): AgentWorkspaceAction[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  const actions: AgentWorkspaceAction[] = [];

  for (const item of input) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const candidate = item as {
      kind?: string;
      content?: unknown;
      find?: unknown;
      replaceWith?: unknown;
    };

    if (
      (candidate.kind === "write" || candidate.kind === "append") &&
      typeof candidate.content === "string"
    ) {
      actions.push({
        kind: candidate.kind,
        content: candidate.content,
      });
      continue;
    }

    if (
      candidate.kind === "replace" &&
      typeof candidate.find === "string" &&
      candidate.find.length > 0 &&
      typeof candidate.replaceWith === "string"
    ) {
      actions.push({
        kind: "replace",
        find: candidate.find,
        replaceWith: candidate.replaceWith,
      });
    }
  }

  return actions;
};

const parseAssistantEnvelope = (
  input: string,
): {
  message: string;
  workspaceActions: AgentWorkspaceAction[];
} => {
  const normalized = normalizeRawAssistantPayload(input);
  if (!normalized) {
    return { message: "", workspaceActions: [] };
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return { message: normalized, workspaceActions: [] };
    }

    const candidate = parsed as {
      reply?: unknown;
      workspaceActions?: unknown;
    };
    const message =
      typeof candidate.reply === "string" ? candidate.reply.trim() : "";
    const workspaceActions = parseWorkspaceActions(candidate.workspaceActions);

    if (message || workspaceActions.length > 0) {
      return {
        message: message || "Workspace updated.",
        workspaceActions,
      };
    }
  } catch {
    return { message: normalized, workspaceActions: [] };
  }

  return { message: normalized, workspaceActions: [] };
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
  const sessionId = (body.sessionId ?? "").trim();
  const workspaceTitle = (body.workspace?.title ?? "").trim();
  const workspaceContent = body.workspace?.content;
  const workspace =
    workspaceTitle && typeof workspaceContent === "string"
      ? {
          fileTitle: workspaceTitle,
          fileContent: workspaceContent,
        }
      : undefined;
  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (item): item is { role: "user" | "assistant"; content: string } =>
            Boolean(
              item &&
              (item.role === "user" || item.role === "assistant") &&
              typeof item.content === "string",
            ),
        )
        .map((item) => ({
          role: item.role,
          content: item.content.trim(),
        }))
        .filter((item) => item.content.length > 0)
        .slice(-12)
    : [];

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
  const runtimeConfig = getAgentProviderChatRuntimeConfig(providerId);
  const serverAccessToken =
    runtimeConfig?.authMode === "static-token" && runtimeConfig.staticToken
      ? runtimeConfig.staticToken
      : undefined;
  const effectiveAccessToken = token?.accessToken ?? serverAccessToken;

  let responseText: string;
  let workspaceActions: AgentWorkspaceAction[] = [];
  if (effectiveAccessToken) {
    try {
      const liveText = await requestAgentLiveChat({
        providerId,
        accessToken: effectiveAccessToken,
        message,
        history,
        modelOverride: model || undefined,
        workspace,
      });
      if (liveText) {
        const parsedLive = parseAssistantEnvelope(liveText);
        responseText = parsedLive.message;
        workspaceActions = parsedLive.workspaceActions;
      } else {
        responseText = createMockAgentResponse({
          providerLabel: connection.providerLabel,
          message,
          history,
          sessionId: sessionId || undefined,
        });
      }
    } catch {
      responseText = createMockAgentResponse({
        providerLabel: connection.providerLabel,
        message,
        history,
        sessionId: sessionId || undefined,
      });
    }
  } else {
    responseText = createMockAgentResponse({
      providerLabel: connection.providerLabel,
      message,
      history,
      sessionId: sessionId || undefined,
    });
  }

  return NextResponse.json({
    role: "assistant",
    providerId,
    providerLabel: connection.providerLabel,
    message: responseText,
    workspaceActions,
  });
}
