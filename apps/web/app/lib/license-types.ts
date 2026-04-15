export const LICENSE_SESSION_COOKIE = "mathend.license.session.v1";

export type LicenseSessionPayload = {
  version: 1;
  productId: string;
  checkoutUrl: string;
  licenseKey: string;
  licenseKeyPreview: string;
  buyerEmail: string;
  saleId: string;
  activatedAt: string;
  lastVerifiedAt: string;
};

export type LicenseStatusResponse = {
  configured: boolean;
  licensed: boolean;
  checkoutUrl: string;
  productId?: string;
  buyerEmail?: string;
  licenseKeyPreview?: string;
  activatedAt?: string;
  lastVerifiedAt?: string;
  reverifyDays?: number;
  reason?: string;
  error?: string;
};
