import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getGumroadRuntimeConfig,
  verifyGumroadLicense,
} from "../../apps/web/app/lib/gumroad-license";

const ENV_KEYS = [
  "GUMROAD_PRODUCT_ID",
  "GUMROAD_API_BASE",
  "GUMROAD_CHECKOUT_URL",
  "LICENSE_REVERIFY_DAYS",
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

describe("web gumroad runtime", () => {
  afterEach(() => {
    resetEnv();
    vi.restoreAllMocks();
  });

  it("returns defaults when env is missing", () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    const config = getGumroadRuntimeConfig();

    expect(config.enabled).toBe(false);
    expect(config.apiBase).toBe("https://api.gumroad.com");
    expect(config.checkoutUrl).toBe("https://muhamsyad.gumroad.com/l/mathend");
    expect(config.reverifyDays).toBe(7);
  });

  it("returns success for valid license", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            purchase: {
              email: "buyer@example.com",
              sale_id: "sale_123",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );

    const result = await verifyGumroadLicense({
      productId: "product_1",
      apiBase: "https://api.gumroad.com",
      licenseKey: "ABCD-EFGH-IJKL-MNOP",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.saleId).toBe("sale_123");
    }
  });

  it("returns revoked when purchase is refunded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            purchase: {
              sale_id: "sale_123",
              refunded: true,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );

    const result = await verifyGumroadLicense({
      productId: "product_1",
      apiBase: "https://api.gumroad.com",
      licenseKey: "ABCD-EFGH-IJKL-MNOP",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("revoked");
    }
  });
});
