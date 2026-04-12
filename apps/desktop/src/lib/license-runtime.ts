import { invoke } from "@tauri-apps/api/core";
import type {
  LicenseSessionPayload,
  LicenseStatusResponse,
} from "./license-types";

export const DEFAULT_GUMROAD_API_BASE = "https://api.gumroad.com";
export const DEFAULT_GUMROAD_CHECKOUT_URL =
  "https://muhamsyad.gumroad.com/l/mathend";
export const DEFAULT_LICENSE_REVERIFY_DAYS = 7;

export type DesktopLicenseRuntimeConfig = {
  productId: string;
  apiBase: string;
  checkoutUrl: string;
  reverifyDays: number;
  enabled: boolean;
};

export type VerifyLicensePurchase = {
  email?: string;
  saleId?: string;
  id?: string;
  refunded?: boolean;
  disputed?: boolean;
  chargebacked?: boolean;
};

export type VerifyDesktopLicenseResult =
  | {
      ok: true;
      purchase: VerifyLicensePurchase;
      saleId: string;
    }
  | {
      ok: false;
      reason: "invalid" | "revoked" | "network";
      message: string;
      status?: number;
    };

export const getDesktopLicenseRuntimeConfig =
  (): DesktopLicenseRuntimeConfig => {
    const productId = (import.meta.env.VITE_GUMROAD_PRODUCT_ID ?? "").trim();

    const apiBaseRaw = (import.meta.env.VITE_GUMROAD_API_BASE ?? "").trim();
    const apiBase =
      apiBaseRaw.length > 0
        ? apiBaseRaw.replace(/\/$/, "")
        : DEFAULT_GUMROAD_API_BASE;

    const checkoutUrlRaw = (
      import.meta.env.VITE_GUMROAD_CHECKOUT_URL ?? ""
    ).trim();
    const checkoutUrl =
      checkoutUrlRaw.length > 0 ? checkoutUrlRaw : DEFAULT_GUMROAD_CHECKOUT_URL;

    const reverifyDaysRaw = Number(import.meta.env.VITE_LICENSE_REVERIFY_DAYS);
    const reverifyDays =
      Number.isFinite(reverifyDaysRaw) && reverifyDaysRaw > 0
        ? Math.floor(reverifyDaysRaw)
        : DEFAULT_LICENSE_REVERIFY_DAYS;

    return {
      productId,
      apiBase,
      checkoutUrl,
      reverifyDays,
      enabled: productId.length > 0,
    };
  };

export const maskLicenseKey = (licenseKey: string): string => {
  const compact = licenseKey.replace(/\s+/g, "").toUpperCase();
  if (compact.length <= 8) {
    return compact;
  }

  const head = compact.slice(0, 4);
  const tail = compact.slice(-4);
  return `${head}...${tail}`;
};

export const isSessionReverifyDue = (
  payload: LicenseSessionPayload,
  reverifyDays: number,
): boolean => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const lastVerifiedAtMs = Date.parse(payload.lastVerifiedAt);
  if (!Number.isFinite(lastVerifiedAtMs)) {
    return true;
  }

  return Date.now() - lastVerifiedAtMs >= reverifyDays * DAY_MS;
};

export const toLicensedStatus = (
  payload: LicenseSessionPayload,
  config: DesktopLicenseRuntimeConfig,
): LicenseStatusResponse => {
  return {
    configured: true,
    licensed: true,
    checkoutUrl: config.checkoutUrl,
    productId: payload.productId,
    buyerEmail: payload.buyerEmail,
    licenseKeyPreview: payload.licenseKeyPreview,
    activatedAt: payload.activatedAt,
    lastVerifiedAt: payload.lastVerifiedAt,
    reverifyDays: config.reverifyDays,
  };
};

export const verifyDesktopGumroadLicense = async (params: {
  productId: string;
  apiBase: string;
  licenseKey: string;
  incrementUsesCount?: boolean;
}): Promise<VerifyDesktopLicenseResult> => {
  return invoke<VerifyDesktopLicenseResult>("verify_gumroad_license", params);
};
