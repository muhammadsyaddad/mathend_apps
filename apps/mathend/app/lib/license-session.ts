import { createHmac, timingSafeEqual } from "node:crypto";
import type { LicenseSessionPayload } from "./license-types";

const readEnv = (name: string): string => process.env[name]?.trim() ?? "";

const base64UrlEncode = (value: string): string => {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const base64UrlDecode = (value: string): string | null => {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (padded.length % 4)) % 4;
    const withPad = padded + "=".repeat(padLength);
    return Buffer.from(withPad, "base64").toString("utf8");
  } catch {
    return null;
  }
};

const sign = (payloadSegment: string, secret: string): string => {
  return createHmac("sha256", secret)
    .update(payloadSegment)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const safeSignatureMatch = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const isLicenseSessionPayload = (
  candidate: unknown,
): candidate is LicenseSessionPayload => {
  if (typeof candidate !== "object" || candidate === null) {
    return false;
  }

  const payload = candidate as Partial<LicenseSessionPayload>;
  return (
    payload.version === 1 &&
    typeof payload.productId === "string" &&
    payload.productId.length > 0 &&
    typeof payload.checkoutUrl === "string" &&
    payload.checkoutUrl.length > 0 &&
    typeof payload.licenseKey === "string" &&
    payload.licenseKey.length > 0 &&
    typeof payload.licenseKeyPreview === "string" &&
    payload.licenseKeyPreview.length > 0 &&
    typeof payload.buyerEmail === "string" &&
    payload.buyerEmail.length > 0 &&
    typeof payload.saleId === "string" &&
    payload.saleId.length > 0 &&
    typeof payload.activatedAt === "string" &&
    payload.activatedAt.length > 0 &&
    typeof payload.lastVerifiedAt === "string" &&
    payload.lastVerifiedAt.length > 0
  );
};

export const getLicenseSessionSecret = (): string => {
  return readEnv("LICENSE_COOKIE_SECRET");
};

export const signLicenseSession = (
  payload: LicenseSessionPayload,
  secret: string,
): string => {
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadSegment, secret);
  return `${payloadSegment}.${signature}`;
};

export const parseSignedLicenseSession = (
  token: string | undefined,
  secret: string,
): LicenseSessionPayload | null => {
  if (!token) {
    return null;
  }

  const [payloadSegment, signature] = token.split(".");
  if (!payloadSegment || !signature) {
    return null;
  }

  const expectedSignature = sign(payloadSegment, secret);
  if (!safeSignatureMatch(signature, expectedSignature)) {
    return null;
  }

  const decoded = base64UrlDecode(payloadSegment);
  if (!decoded) {
    return null;
  }

  try {
    const parsed = JSON.parse(decoded) as unknown;
    return isLicenseSessionPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
};
