import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLemonSqueezyRuntimeConfig,
  verifyLemonSqueezyLicense,
} from "../../apps/mathend/app/lib/lemonsqueezy-license";

const resetEnv = () => {
  delete process.env.LEMONSQUEEZY_PRODUCT_ID;
  delete process.env.LEMONSQUEEZY_API_BASE;
  delete process.env.LEMONSQUEEZY_CHECKOUT_URL;
  delete process.env.LICENSE_REVERIFY_DAYS;
};

describe("lemonsqueezy-license runtime", () => {
  afterEach(() => {
    resetEnv();
    vi.restoreAllMocks();
  });

  it("returns defaults when env is empty", () => {
    resetEnv();
    const config = getLemonSqueezyRuntimeConfig();

    expect(config.enabled).toBe(false);
    expect(config.apiBase).toBe("https://api.lemonsqueezy.com");
    expect(config.checkoutUrl).toBe("https://lemonsqueezy.com");
    expect(config.reverifyDays).toBe(7);
  });

  it("verifies valid license payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            valid: true,
            error: null,
            license_key: {
              id: 98,
              status: "active",
            },
            meta: {
              product_id: "product_1",
              order_id: 321,
              order_item_id: 654,
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
      incrementUsesCount: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.saleId).toBe("654");
      expect(result.purchase.email).toBe("buyer@example.com");
    }
  });

  it("returns revoked when license status is disabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            valid: true,
            error: null,
            license_key: {
              id: 21,
              status: "disabled",
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
