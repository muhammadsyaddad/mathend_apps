import { afterEach, describe, expect, it } from "vitest";
import {
  getOAuthProviderRuntimeConfig,
  isOAuthProviderConfigured,
} from "../../apps/mathend/app/lib/oauth-provider-runtime";

const resetGithubOauthEnv = () => {
  delete process.env.MATHEND_GITHUB_COPILOT_CLIENT_ID;
  delete process.env.MATHEND_GITHUB_COPILOT_CLIENT_SECRET;
  delete process.env.MATHEND_GITHUB_COPILOT_AUTH_URL;
  delete process.env.MATHEND_GITHUB_COPILOT_TOKEN_URL;
  delete process.env.MATHEND_GITHUB_COPILOT_DEVICE_CODE_URL;
  delete process.env.MATHEND_GITHUB_COPILOT_SCOPE;
};

describe("oauth-provider-runtime github-copilot", () => {
  afterEach(() => {
    resetGithubOauthEnv();
  });

  it("considers github configured for device flow without client secret", () => {
    resetGithubOauthEnv();
    process.env.MATHEND_GITHUB_COPILOT_CLIENT_ID = "github-client-id";

    const config = getOAuthProviderRuntimeConfig("github-copilot");

    expect(config.deviceCodeUrl).toBe("https://github.com/login/device/code");
    expect(config.clientSecret).toBe("");
    expect(isOAuthProviderConfigured(config)).toBe(true);
  });

  it("uses built-in default GitHub Copilot app client id", () => {
    resetGithubOauthEnv();

    const config = getOAuthProviderRuntimeConfig("github-copilot");

    expect(config.clientId).toBe("Ov23li8tweQw6odWQebz");
    expect(config.scope).toBe("read:user");
    expect(isOAuthProviderConfigured(config)).toBe(true);
  });
});
