import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requestAgentLiveChat } from "../../../lib/agent-chat-live";
import { resolveGitHubCopilotAccessToken } from "../../../lib/agent-copilot-token";
import {
  getAgentProviderLabel,
  isAgentProviderId,
  type AgentProviderId,
} from "../../../lib/agent-providers";
import { getAgentProviderChatRuntimeConfig } from "../../../lib/agent-provider-chat-runtime";
import {
  serializeOAuthTokens,
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
  stream?: boolean;
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

type ReplyPreviewExtractor = {
  push: (chunk: string) => string;
};

const encodeNdjson = (encoder: TextEncoder, payload: unknown): Uint8Array => {
  return encoder.encode(`${JSON.stringify(payload)}\n`);
};

const buildThinkingPlanPreview = (
  userMessage: string,
  workspaceTitle?: string,
): string => {
  const compactMessage = userMessage.replace(/\s+/g, " ").trim();

  if (!compactMessage) {
    return "Understand request intent, then prepare a concise response.";
  }

  const messageSnippet =
    compactMessage.length > 90
      ? `${compactMessage.slice(0, 87)}...`
      : compactMessage;

  if (/\b(derive|derivation|proof|explain|show)\b/i.test(compactMessage)) {
    return `Break the derivation into clean steps, then summarize the final result for: ${messageSnippet}`;
  }

  if (
    /\b(write|rewrite|append|replace|format|edit|update)\b/i.test(
      compactMessage,
    )
  ) {
    if (workspaceTitle) {
      return `Draft workspace-safe edits for ${workspaceTitle}, then return a concise response.`;
    }
    return "Draft workspace-safe edits first, then return concise final output.";
  }

  if (workspaceTitle) {
    return `Analyze request in context of ${workspaceTitle}, then write a concise final answer.`;
  }

  return "Analyze request, build a short plan, then produce concise final answer.";
};

const createReplyPreviewExtractor = (): ReplyPreviewExtractor => {
  const replyMarker = /"reply"\s*:\s*"/;
  let raw = "";
  let hasReplyStarted = false;
  let parseIndex = 0;
  let inEscape = false;
  let hasReplyEnded = false;
  let encodedReply = "";
  let decodedReply = "";

  const decodePartialJsonString = (encoded: string): string => {
    let safe = encoded;

    if (safe.endsWith("\\")) {
      safe += "\\";
    }

    const partialUnicode = safe.match(/\\u[0-9a-fA-F]{0,3}$/);
    if (partialUnicode) {
      const currentDigits = partialUnicode[0].length - 2;
      safe += "0".repeat(4 - currentDigits);
    }

    try {
      return JSON.parse(`"${safe}"`) as string;
    } catch {
      return safe
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
  };

  return {
    push: (chunk: string): string => {
      if (!chunk || hasReplyEnded) {
        return "";
      }

      raw += chunk;

      if (!hasReplyStarted) {
        const markerMatch = replyMarker.exec(raw);
        if (!markerMatch || markerMatch.index === undefined) {
          if (raw.length > 2048) {
            raw = raw.slice(-512);
          }
          return "";
        }

        hasReplyStarted = true;
        parseIndex = markerMatch.index + markerMatch[0].length;
      }

      while (parseIndex < raw.length && !hasReplyEnded) {
        const char = raw[parseIndex];

        if (inEscape) {
          encodedReply += char;
          inEscape = false;
          parseIndex += 1;
          continue;
        }

        if (char === "\\") {
          encodedReply += char;
          inEscape = true;
          parseIndex += 1;
          continue;
        }

        if (char === '"') {
          hasReplyEnded = true;
          parseIndex += 1;
          break;
        }

        encodedReply += char;
        parseIndex += 1;
      }

      const nextDecoded = decodePartialJsonString(encodedReply);
      if (!nextDecoded) {
        return "";
      }

      if (nextDecoded.startsWith(decodedReply)) {
        const delta = nextDecoded.slice(decodedReply.length);
        decodedReply = nextDecoded;
        return delta;
      }

      decodedReply = nextDecoded;
      return nextDecoded;
    },
  };
};

const updateTokenCookie = async (input: {
  request: Request;
  providerId: AgentProviderId;
  cookieStore: Awaited<ReturnType<typeof cookies>>;
  tokenMap: ReturnType<typeof parseOAuthTokens>;
  tokenPatch: Partial<
    NonNullable<ReturnType<typeof parseOAuthTokens>[AgentProviderId]>
  >;
}): Promise<void> => {
  const existingToken = input.tokenMap[input.providerId];
  if (!existingToken) {
    return;
  }

  input.tokenMap[input.providerId] = {
    ...existingToken,
    ...input.tokenPatch,
    updatedAt: new Date().toISOString(),
  };

  input.cookieStore.set({
    name: OAUTH_TOKENS_COOKIE,
    value: serializeOAuthTokens(input.tokenMap),
    httpOnly: true,
    secure: new URL(input.request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
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

const extractJsonCandidates = (input: string): string[] => {
  const normalized = normalizeRawAssistantPayload(input);
  if (!normalized) {
    return [];
  }

  const candidates = [normalized];

  const fencedMatches = normalized.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of fencedMatches) {
    const candidate = (match[1] ?? "").trim();
    if (candidate) {
      candidates.push(candidate);
    }
  }

  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      if (depth === 0) {
        continue;
      }

      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        const candidate = normalized.slice(startIndex, index + 1).trim();
        if (candidate) {
          candidates.push(candidate);
        }
        startIndex = -1;
      }
    }
  }

  return Array.from(new Set(candidates));
};

const sanitizeInvalidJsonEscapes = (input: string): string => {
  const validEscapes = new Set([`"`, "\\", "/", "b", "f", "n", "r", "t", "u"]);
  let output = "";
  let inString = false;
  let escaping = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (escaping) {
      output += char;
      escaping = false;
      continue;
    }

    if (char === '"') {
      output += char;
      inString = !inString;
      continue;
    }

    if (char === "\\" && inString) {
      const next = input[index + 1] ?? "";
      if (validEscapes.has(next)) {
        output += char;
        escaping = true;
      } else {
        output += "\\\\";
      }
      continue;
    }

    output += char;
  }

  return output;
};

const parseAssistantEnvelopeCandidate = (
  candidateText: string,
): unknown | null => {
  try {
    return JSON.parse(candidateText) as unknown;
  } catch {
    const sanitized = sanitizeInvalidJsonEscapes(candidateText);
    if (sanitized === candidateText) {
      return null;
    }

    try {
      return JSON.parse(sanitized) as unknown;
    } catch {
      return null;
    }
  }
};

const parseWorkspaceActions = (input: unknown): AgentWorkspaceAction[] => {
  if (typeof input === "string") {
    try {
      return parseWorkspaceActions(JSON.parse(input) as unknown);
    } catch {
      return [];
    }
  }

  const normalizedInput = Array.isArray(input)
    ? input
    : typeof input === "object" && input !== null
      ? [input]
      : [];
  if (normalizedInput.length === 0) {
    return [];
  }

  const actions: AgentWorkspaceAction[] = [];

  for (const item of normalizedInput) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const candidate = item as {
      kind?: string;
      type?: string;
      content?: unknown;
      text?: unknown;
      find?: unknown;
      replaceWith?: unknown;
      replace?: unknown;
    };
    const actionKind = candidate.kind ?? candidate.type;
    const actionContent =
      typeof candidate.content === "string"
        ? candidate.content
        : typeof candidate.text === "string"
          ? candidate.text
          : undefined;

    if (
      (actionKind === "write" || actionKind === "append") &&
      typeof actionContent === "string"
    ) {
      actions.push({
        kind: actionKind,
        content: actionContent,
      });
      continue;
    }

    const replaceWith =
      typeof candidate.replaceWith === "string"
        ? candidate.replaceWith
        : typeof candidate.replace === "string"
          ? candidate.replace
          : undefined;

    if (
      actionKind === "replace" &&
      typeof candidate.find === "string" &&
      candidate.find.length > 0 &&
      typeof replaceWith === "string"
    ) {
      actions.push({
        kind: "replace",
        find: candidate.find,
        replaceWith,
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

  for (const candidateText of extractJsonCandidates(input)) {
    const parsed = parseAssistantEnvelopeCandidate(candidateText);
    if (typeof parsed !== "object" || parsed === null) {
      continue;
    }

    const candidate = parsed as {
      reply?: unknown;
      message?: unknown;
      workspaceActions?: unknown;
      actions?: unknown;
    };
    const message =
      typeof candidate.reply === "string"
        ? candidate.reply.trim()
        : typeof candidate.message === "string"
          ? candidate.message.trim()
          : "";
    const workspaceActions = parseWorkspaceActions(
      candidate.workspaceActions ?? candidate.actions,
    );

    if (message || workspaceActions.length > 0) {
      return {
        message: message || "Workspace updated.",
        workspaceActions,
      };
    }
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
  const runtimeConfig = getAgentProviderChatRuntimeConfig(providerId);
  if (!runtimeConfig) {
    return NextResponse.json(
      { error: `Chat runtime is not configured for ${providerId}.` },
      { status: 400 },
    );
  }

  const connectionMap = parseOAuthConnections(
    cookieStore.get(OAUTH_CONNECTIONS_COOKIE)?.value,
  );
  const connection = connectionMap[providerId];
  const providerLabel =
    connection?.providerLabel ?? getAgentProviderLabel(providerId);
  const requiresOAuthConnection = runtimeConfig.authMode === "oauth-token";
  if (requiresOAuthConnection && !connection) {
    return NextResponse.json(
      { error: "Provider is not connected via OAuth yet." },
      { status: 401 },
    );
  }

  const tokenMap = parseOAuthTokens(
    cookieStore.get(OAUTH_TOKENS_COOKIE)?.value,
  );
  const token = tokenMap[providerId];
  const serverAccessToken =
    runtimeConfig?.authMode === "static-token" && runtimeConfig.staticToken
      ? runtimeConfig.staticToken
      : undefined;
  let effectiveAccessToken = token?.accessToken ?? serverAccessToken;

  if (
    providerId === "github-copilot" &&
    token?.accessToken &&
    runtimeConfig.authMode === "oauth-token"
  ) {
    const copilotTokenResult = await resolveGitHubCopilotAccessToken({
      oauthAccessToken: token.accessToken,
      tokenSet: token,
    });
    effectiveAccessToken = copilotTokenResult.accessToken;

    if (copilotTokenResult.cacheUpdate) {
      await updateTokenCookie({
        request,
        providerId,
        cookieStore,
        tokenMap,
        tokenPatch: copilotTokenResult.cacheUpdate,
      });
    }
  }

  if (!effectiveAccessToken) {
    return NextResponse.json(
      {
        error:
          "Provider connected, but access token is missing. Reconnect OAuth or set server token.",
      },
      { status: 401 },
    );
  }

  const shouldStream = body.stream === true;

  if (shouldStream) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();

        const enqueueEvent = (payload: unknown) => {
          try {
            controller.enqueue(encodeNdjson(encoder, payload));
            return true;
          } catch {
            return false;
          }
        };

        void (async () => {
          try {
            enqueueEvent({
              type: "plan",
              plan: buildThinkingPlanPreview(
                message,
                workspaceTitle || undefined,
              ),
            });

            const previewExtractor = createReplyPreviewExtractor();
            const liveText = await requestAgentLiveChat({
              providerId,
              accessToken: effectiveAccessToken,
              message,
              history,
              modelOverride: model || undefined,
              workspace,
              onTextDelta: (chunk) => {
                const replyDelta = previewExtractor.push(chunk);
                if (!replyDelta) {
                  return;
                }

                enqueueEvent({
                  type: "delta",
                  delta: replyDelta,
                });
              },
            });

            if (!liveText) {
              enqueueEvent({
                type: "error",
                error: "Live provider returned empty response.",
              });
              return;
            }

            const parsedLive = parseAssistantEnvelope(liveText);
            enqueueEvent({
              type: "done",
              role: "assistant",
              providerId,
              providerLabel,
              message: parsedLive.message,
              workspaceActions: parsedLive.workspaceActions,
            });
          } catch (error) {
            enqueueEvent({
              type: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Live chat request failed.",
            });
          } finally {
            controller.close();
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  let responseText: string;
  let workspaceActions: AgentWorkspaceAction[] = [];
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
      return NextResponse.json(
        { error: "Live provider returned empty response." },
        { status: 502 },
      );
    }
  } catch (error) {
    const messageFromError =
      error instanceof Error ? error.message : "Live chat request failed.";
    return NextResponse.json({ error: messageFromError }, { status: 502 });
  }

  return NextResponse.json({
    role: "assistant",
    providerId,
    providerLabel,
    message: responseText,
    workspaceActions,
  });
}
