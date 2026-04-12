import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getGumroadRuntimeConfig,
  verifyGumroadLicense,
} from "../../apps/mathend/app/lib/gumroad-license";

const resetEnv = () => {
  delete process.env.GUMROAD_PRODUCT_ID;
  delete process.env.GUMROAD_API_BASE;
  delete process.env.GUMROAD_CHECKOUT_URL;
  delete process.env.LICENSE_REVERIFY_DAYS;
};

describe("gumroad-license runtime", () => {
  afterEach(() => {
    resetEnv();
    vi.restoreAllMocks();
  });

  it("returns defaults when env is empty", () => {
    resetEnv();
    const config = getGumroadRuntimeConfig();

    expect(config.enabled).toBe(false);
    expect(config.apiBase).toBe("https://api.gumroad.com");
    expect(config.checkoutUrl).toBe("https://muhamsyad.gumroad.com/l/mathend");
    expect(config.reverifyDays).toBe(7);
  });

  it("verifies valid license payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            purchase: {
              email: "buyer@example.com",
              sale_id: "sale_001",
              refunded: false,
              disputed: false,
              chargebacked: false,
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
      incrementUsesCount: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.saleId).toBe("sale_001");
      expect(result.purchase.email).toBe("buyer@example.com");
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
              sale_id: "sale_001",
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
