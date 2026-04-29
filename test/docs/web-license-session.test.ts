import { describe, expect, it } from "vitest";
import {
  parseSignedLicenseSession,
  signLicenseSession,
} from "../../apps/web/app/lib/license-session";
import type { LicenseSessionPayload } from "../../apps/web/app/lib/license-types";

describe("web license session", () => {
  const payload: LicenseSessionPayload = {
    version: 1,
    productId: "product_123",
    checkoutUrl: "https://lemonsqueezy.com",
    licenseKey: "ABCD-EFGH-IJKL-MNOP",
    licenseKeyPreview: "ABCD...MNOP",
    buyerEmail: "buyer@example.com",
    saleId: "sale_123",
    activatedAt: "2026-04-15T00:00:00.000Z",
    lastVerifiedAt: "2026-04-15T00:00:00.000Z",
  };

  it("signs and parses valid token", () => {
    const secret = "web-secret";
    const token = signLicenseSession(payload, secret);

    const parsed = parseSignedLicenseSession(token, secret);

    expect(parsed).toEqual(payload);
  });

  it("returns null for malformed token", () => {
    expect(parseSignedLicenseSession("invalid", "web-secret")).toBeNull();
  });

  it("returns null for wrong secret", () => {
    const token = signLicenseSession(payload, "secret-a");
    expect(parseSignedLicenseSession(token, "secret-b")).toBeNull();
  });
});
