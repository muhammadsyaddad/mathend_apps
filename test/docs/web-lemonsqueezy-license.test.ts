import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLemonSqueezyRuntimeConfig,
  verifyLemonSqueezyLicense,
} from "../../apps/web/app/lib/lemonsqueezy-license";

const ENV_KEYS = [
  "LEMONSQUEEZY_PRODUCT_ID",
  "LEMONSQUEEZY_API_BASE",
  "LEMONSQUEEZY_CHECKOUT_URL",
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

describe("web lemonsqueezy runtime", () => {
  afterEach(() => {
    resetEnv();
    vi.restoreAllMocks();
  });

  it("returns defaults when env is missing", () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    const config = getLemonSqueezyRuntimeConfig();

    expect(config.enabled).toBe(false);
    expect(config.apiBase).toBe("https://api.lemonsqueezy.com");
    expect(config.checkoutUrl).toBe("https://lemonsqueezy.com");
    expect(config.reverifyDays).toBe(7);
  });

  it("returns success for valid license", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            valid: true,
            error: null,
            license_key: {
              id: 10,
              status: "active",
            },
            meta: {
              product_id: "product_1",
              order_item_id: "sale_123",
              customer_email: "buyer@example.com",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );

    const result = await verifyLemonSqueezyLicense({
      productId: "product_1",
      apiBase: "https://api.lemonsqueezy.com",
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
            valid: true,
            error: null,
            license_key: {
              id: 10,
              status: "expired",
            },
            meta: {
              product_id: "product_1",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );

    const result = await verifyLemonSqueezyLicense({
      productId: "product_1",
      apiBase: "https://api.lemonsqueezy.com",
      licenseKey: "ABCD-EFGH-IJKL-MNOP",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("revoked");
    }
  });
});
