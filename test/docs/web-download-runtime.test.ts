import { afterEach, describe, expect, it } from "vitest";
import {
  createDownloadToken,
  getDownloadRuntimeConfig,
  parseDownloadPlatform,
  parseDownloadToken,
} from "../../apps/web/app/lib/download-runtime";

const ENV_KEYS = [
  "WEB_DOWNLOAD_TOKEN_SECRET",
  "LICENSE_COOKIE_SECRET",
  "WEB_DOWNLOAD_TOKEN_TTL_SECONDS",
  "WEB_DOWNLOAD_WINDOWS_URL",
  "WEB_DOWNLOAD_WINDOWS_FILENAME",
  "WEB_DOWNLOAD_MACOS_URL",
  "WEB_DOWNLOAD_MACOS_FILENAME",
  "WEB_DOWNLOAD_LINUX_URL",
  "WEB_DOWNLOAD_LINUX_FILENAME",
  "WEB_DOWNLOAD_UPSTREAM_BEARER_TOKEN",
] as const;

const originalEnv = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

const resetEnv = () => {
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
};

describe("web download runtime", () => {
  afterEach(() => {
    resetEnv();
  });

  it("creates and parses signed download token", () => {
    const { token } = createDownloadToken({
      platform: "windows",
      saleId: "sale_abc",
      secret: "token-secret",
      ttlSeconds: 120,
      nowMs: 1_000,
    });

    const parsed = parseDownloadToken(token, "token-secret", 10_000);

    expect(parsed).not.toBeNull();
    expect(parsed?.platform).toBe("windows");
    expect(parsed?.saleId).toBe("sale_abc");
  });

  it("rejects tampered and expired token", () => {
    const { token } = createDownloadToken({
      platform: "linux",
      saleId: "sale_xyz",
      secret: "token-secret",
      ttlSeconds: 30,
      nowMs: 1_000,
    });

    expect(parseDownloadToken(`${token}x`, "token-secret", 2_000)).toBeNull();
    expect(parseDownloadToken(token, "token-secret", 40_000)).toBeNull();
  });

  it("builds runtime config from env", () => {
    process.env.LICENSE_COOKIE_SECRET = "license-secret";
    process.env.WEB_DOWNLOAD_TOKEN_TTL_SECONDS = "600";
    process.env.WEB_DOWNLOAD_WINDOWS_URL =
      "https://cdn.example.com/mathend/windows-installer.exe";
    process.env.WEB_DOWNLOAD_MACOS_URL =
      "https://cdn.example.com/mathend/macos-installer.dmg";
    process.env.WEB_DOWNLOAD_UPSTREAM_BEARER_TOKEN = "upstream-token";

    const runtime = getDownloadRuntimeConfig();

    expect(runtime.artifacts).toHaveLength(2);
    expect(runtime.tokenSecret).toBe("license-secret");
    expect(runtime.tokenTtlSeconds).toBe(600);
    expect(runtime.upstreamBearerToken).toBe("upstream-token");
    expect(runtime.artifacts[0]?.platform).toBe("windows");
    expect(runtime.artifacts[1]?.platform).toBe("macos");
  });

  it("parses allowed download platform", () => {
    expect(parseDownloadPlatform("windows")).toBe("windows");
    expect(parseDownloadPlatform("android")).toBeNull();
  });
});
