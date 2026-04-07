export const AGENT_PROVIDER_CATALOG = [
  {
    id: "github-copilot",
    label: "GitHub Copilot",
  },
  {
    id: "claude-code",
    label: "Claude Code AI",
  },
] as const;

export type AgentProviderId = (typeof AGENT_PROVIDER_CATALOG)[number]["id"];

const providerIdSet = new Set<string>(
  AGENT_PROVIDER_CATALOG.map((provider) => provider.id),
);

export const isAgentProviderId = (value: string): value is AgentProviderId =>
  providerIdSet.has(value);

export const getAgentProviderLabel = (providerId: AgentProviderId): string =>
  AGENT_PROVIDER_CATALOG.find((provider) => provider.id === providerId)
    ?.label ?? providerId;
