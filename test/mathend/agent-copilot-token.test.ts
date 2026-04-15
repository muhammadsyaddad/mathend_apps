import { describe, expect, it } from "vitest";
import { resolveGitHubCopilotAccessToken } from "../../apps/mathend/app/lib/agent-copilot-token";

describe("agent-copilot-token", () => {
  it("returns cached token when refresh deadline not reached", async () => {
    const now = Date.now();
    const result = await resolveGitHubCopilotAccessToken({
      oauthAccessToken: "oauth-token",
      tokenSet: {
        accessToken: "oauth-token",
        tokenType: "Bearer",
        updatedAt: new Date(now).toISOString(),
        copilotAccessToken: "copilot-session-token",
        copilotRefreshAfter: new Date(now + 60_000).toISOString(),
      },
    });

    expect(result.accessToken).toBe("copilot-session-token");
  });

  it("falls back to oauth token when exchange endpoint is unavailable", async () => {
    const result = await resolveGitHubCopilotAccessToken({
      oauthAccessToken: "oauth-token",
      tokenExchangeEndpoint: "https://127.0.0.1:1/copilot_internal/v2/token",
    });

    expect(result.accessToken).toBe("oauth-token");
  });
});
