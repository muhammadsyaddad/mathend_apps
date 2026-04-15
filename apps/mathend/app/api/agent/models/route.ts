import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveGitHubCopilotAccessToken } from "../../../lib/agent-copilot-token";
import { getAgentProviderChatRuntimeConfig } from "../../../lib/agent-provider-chat-runtime";
import { isAgentProviderId } from "../../../lib/agent-providers";
import { parseOAuthTokens } from "../../../lib/oauth-cookie-utils";
import { OAUTH_TOKENS_COOKIE } from "../../../lib/oauth-types";

type AgentModelOption = {
  label: string;
  value: string;
};

type GitHubCatalogModel = {
  id?: unknown;
  name?: unknown;
  supported_output_modalities?: unknown;
};

type CopilotModelItem = {
  id?: unknown;
  name?: unknown;
};

const GITHUB_MODEL_CATALOG_URL = "https://models.github.ai/catalog/models";
const COPILOT_MODEL_CATALOG_URL = "https://api.githubcopilot.com/models";

const GITHUB_MODEL_FALLBACK_OPTIONS: AgentModelOption[] = [
  { label: "GPT-4o mini", value: "openai/gpt-4o-mini" },
  { label: "GPT-4.1", value: "openai/gpt-4.1" },
  { label: "GPT-4.1 mini", value: "openai/gpt-4.1-mini" },
  { label: "o4-mini", value: "openai/o4-mini" },
  { label: "gpt-5-chat", value: "openai/gpt-5-chat" },
];

const displayModelLabel = (modelId: string, preferredName?: string): string => {
  if (preferredName && preferredName.trim().length > 0) {
    return preferredName;
  }

  const fallback = modelId.split("/").pop() ?? modelId;
  return fallback;
};

const dedupeModels = (models: AgentModelOption[]): AgentModelOption[] => {
  const seen = new Set<string>();
  const result: AgentModelOption[] = [];

  for (const model of models) {
    if (!model.value || seen.has(model.value)) {
      continue;
    }

    seen.add(model.value);
    result.push(model);
  }

  return result;
};

const withRuntimeModel = (
  models: AgentModelOption[],
  runtimeModel?: string,
): AgentModelOption[] => {
  const normalizedRuntime = (runtimeModel ?? "").trim();
  if (!normalizedRuntime) {
    return dedupeModels(models);
  }

  if (models.some((item) => item.value === normalizedRuntime)) {
    return dedupeModels(models);
  }

  return dedupeModels([
    {
      label: displayModelLabel(normalizedRuntime),
      value: normalizedRuntime,
    },
    ...models,
  ]);
};

const readGitHubCatalogModels = (payload: unknown): AgentModelOption[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  const models: AgentModelOption[] = [];
  for (const item of payload as GitHubCatalogModel[]) {
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!id) {
      continue;
    }

    const outputs = Array.isArray(item.supported_output_modalities)
      ? item.supported_output_modalities
      : [];
    const canOutputText = outputs.some((mode) => mode === "text");
    if (!canOutputText) {
      continue;
    }

    const name = typeof item.name === "string" ? item.name.trim() : "";
    models.push({
      value: id,
      label: displayModelLabel(id, name),
    });
  }

  return dedupeModels(models);
};

const readGitHubCopilotModels = (payload: unknown): AgentModelOption[] => {
  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const candidate = payload as { data?: unknown };
  if (!Array.isArray(candidate.data)) {
    return [];
  }

  const models: AgentModelOption[] = [];
  for (const item of candidate.data as CopilotModelItem[]) {
    const modelId = typeof item.id === "string" ? item.id.trim() : "";
    if (!modelId) {
      continue;
    }

    const modelName = typeof item.name === "string" ? item.name.trim() : "";
    models.push({
      value: modelId,
      label: displayModelLabel(modelId, modelName),
    });
  }

  return dedupeModels(models);
};

const normalizeCopilotModelId = (modelId: string): string => {
  const trimmed = modelId.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/^[^/]+\//, "").trim();
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const providerIdRaw = requestUrl.searchParams.get("providerId") ?? "";

  if (!isAgentProviderId(providerIdRaw)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  }

  const runtimeConfig = getAgentProviderChatRuntimeConfig(providerIdRaw);
  if (providerIdRaw !== "github-copilot") {
    const nonGithubModels = withRuntimeModel([], runtimeConfig?.model);
    return NextResponse.json({ models: nonGithubModels });
  }

  const cookieStore = await cookies();
  const tokenMap = parseOAuthTokens(
    cookieStore.get(OAUTH_TOKENS_COOKIE)?.value,
  );
  const tokenSet = tokenMap[providerIdRaw];
  const oauthToken = tokenSet?.accessToken;
  const copilotToken = tokenSet?.copilotAccessToken;
  const copilotRefreshAfter = tokenSet?.copilotRefreshAfter;
  const copilotTokenValid =
    Boolean(copilotToken) &&
    (!copilotRefreshAfter || Date.now() < Date.parse(copilotRefreshAfter));
  const authToken =
    runtimeConfig?.authMode === "static-token" && runtimeConfig.staticToken
      ? runtimeConfig.staticToken
      : copilotTokenValid
        ? copilotToken
        : oauthToken;

  const runtimeModel = runtimeConfig?.endpoint.includes("api.githubcopilot.com")
    ? normalizeCopilotModelId(runtimeConfig?.model ?? "")
    : (runtimeConfig?.model ?? "").trim();

  const readModelsWithFallback = (
    parsedModels: AgentModelOption[],
    fallbackModels: AgentModelOption[],
    fallbackError: string,
  ) => {
    const models = withRuntimeModel(parsedModels, runtimeModel);
    if (models.length > 0) {
      return NextResponse.json({ models });
    }

    return NextResponse.json({
      models: withRuntimeModel(fallbackModels, runtimeModel),
      error: fallbackError,
    });
  };

  const readCopilotModelsWithoutFallback = (
    parsedModels: AgentModelOption[],
    unavailableError: string,
  ) => {
    const models = dedupeModels(parsedModels);
    if (models.length > 0) {
      return NextResponse.json({ models });
    }

    return NextResponse.json({
      models: [],
      error: unavailableError,
    });
  };

  if (
    runtimeConfig?.authMode === "oauth-token" &&
    runtimeConfig.endpoint.includes("api.githubcopilot.com") &&
    oauthToken
  ) {
    try {
      const copilotTokenResult = await resolveGitHubCopilotAccessToken({
        oauthAccessToken: oauthToken,
        tokenSet,
      });
      const copilotResponse = await fetch(COPILOT_MODEL_CATALOG_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${copilotTokenResult.accessToken}`,
          "User-Agent": "Mathend-Copilot-Bridge",
        },
        cache: "no-store",
      });

      if (!copilotResponse.ok) {
        throw new Error("GitHub Copilot model catalog request failed.");
      }

      const payload = (await copilotResponse.json()) as unknown;
      const parsedModels = readGitHubCopilotModels(payload);
      return readCopilotModelsWithoutFallback(
        parsedModels,
        "No GitHub Copilot models available for this account.",
      );
    } catch {
      return NextResponse.json({
        models: [],
        error:
          "Unable to fetch GitHub Copilot models. Reconnect OAuth and try again.",
      });
    }
  }

  try {
    const response = await fetch(GITHUB_MODEL_CATALOG_URL, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("GitHub model catalog request failed.");
    }

    const payload = (await response.json()) as unknown;
    const parsedModels = readGitHubCatalogModels(payload);
    return readModelsWithFallback(
      parsedModels,
      GITHUB_MODEL_FALLBACK_OPTIONS,
      "Using fallback model list because live catalog is unavailable.",
    );
  } catch {
    return NextResponse.json({
      models: withRuntimeModel(GITHUB_MODEL_FALLBACK_OPTIONS, runtimeModel),
      error: "Using fallback model list because live catalog is unavailable.",
    });
  }
}
