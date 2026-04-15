import { afterEach, describe, expect, it } from "vitest";
import { getAgentProviderChatRuntimeConfig } from "../../apps/mathend/app/lib/agent-provider-chat-runtime";

const resetGithubEnv = () => {
  delete process.env.MATHEND_GITHUB_COPILOT_CHAT_ENDPOINT;
  delete process.env.MATHEND_GITHUB_COPILOT_CHAT_MODEL;
  delete process.env.MATHEND_GITHUB_MODELS_PAT;
  delete process.env.MATHEND_GITHUB_MODELS_ORG;
};

describe("agent-provider-chat-runtime github-copilot", () => {
  afterEach(() => {
    resetGithubEnv();
  });

  it("defaults to GitHub Copilot chat endpoint without PAT", () => {
    resetGithubEnv();

    const config = getAgentProviderChatRuntimeConfig("github-copilot");

    expect(config).not.toBeNull();
    expect(config?.authMode).toBe("oauth-token");
    expect(config?.endpoint).toBe(
      "https://api.githubcopilot.com/chat/completions",
    );
    expect(config?.model).toBe("gpt-4o-mini");
  });

  it("uses static token mode when PAT is provided", () => {
    process.env.MATHEND_GITHUB_MODELS_PAT = "ghp_test_pat";
    process.env.MATHEND_GITHUB_MODELS_ORG = "mathend-org";

    const config = getAgentProviderChatRuntimeConfig("github-copilot");

    expect(config).not.toBeNull();
    expect(config?.authMode).toBe("static-token");
    expect(config?.staticToken).toBe("ghp_test_pat");
    expect(config?.endpoint).toBe(
      "https://models.github.ai/orgs/mathend-org/inference/chat/completions",
    );
  });
});
