import { describe, expect, it } from "vitest";
import {
  parseSignedLicenseSession,
  signLicenseSession,
} from "../../apps/mathend/app/lib/license-session";
import type { LicenseSessionPayload } from "../../apps/mathend/app/lib/license-types";

describe("license-session", () => {
  const payload: LicenseSessionPayload = {
    version: 1,
    productId: "product_123",
    checkoutUrl: "https://lemonsqueezy.com",
    licenseKey: "ABCD-EFGH-IJKL-MNOP",
    licenseKeyPreview: "ABCD...MNOP",
    buyerEmail: "buyer@example.com",
    saleId: "sale_123",
    activatedAt: "2026-04-09T00:00:00.000Z",
    lastVerifiedAt: "2026-04-09T00:00:00.000Z",
  };

  it("signs and parses a valid session token", () => {
    const secret = "test-secret-value";
    const token = signLicenseSession(payload, secret);

    const parsed = parseSignedLicenseSession(token, secret);

    expect(parsed).toEqual(payload);
  });

  it("returns null for tampered token signature", () => {
    const secret = "test-secret-value";
    const token = signLicenseSession(payload, secret);
    const tampered = `${token}tampered`;

    const parsed = parseSignedLicenseSession(tampered, secret);

    expect(parsed).toBeNull();
  });

  it("returns null for malformed token", () => {
    const parsed = parseSignedLicenseSession("not-a-valid-token", "secret");
    expect(parsed).toBeNull();
  });
});
