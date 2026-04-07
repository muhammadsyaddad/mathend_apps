import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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

const GITHUB_MODEL_CATALOG_URL = "https://models.github.ai/catalog/models";

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
  const oauthToken = tokenMap[providerIdRaw]?.accessToken;
  const authToken =
    runtimeConfig?.authMode === "static-token" && runtimeConfig.staticToken
      ? runtimeConfig.staticToken
      : oauthToken;

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
    const models = withRuntimeModel(parsedModels, runtimeConfig?.model);
    if (models.length === 0) {
      throw new Error("GitHub model catalog is empty.");
    }

    return NextResponse.json({ models });
  } catch {
    const fallbackModels = withRuntimeModel(
      GITHUB_MODEL_FALLBACK_OPTIONS,
      runtimeConfig?.model,
    );
    return NextResponse.json({
      models: fallbackModels,
      error: "Using fallback model list because live catalog is unavailable.",
    });
  }
}
