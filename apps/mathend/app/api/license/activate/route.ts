import { NextResponse } from "next/server";
import {
  getGumroadRuntimeConfig,
  verifyGumroadLicense,
} from "../../../lib/gumroad-license";
import {
  getLicenseSessionSecret,
  signLicenseSession,
} from "../../../lib/license-session";
import {
  LICENSE_SESSION_COOKIE,
  type LicenseSessionPayload,
  type LicenseStatusResponse,
} from "../../../lib/license-types";

type ActivateRequestBody = {
  licenseKey?: string;
  email?: string;
};

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 8;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const resolveClientIp = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  if (first) {
    return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
};

const isRateLimited = (key: string): boolean => {
  const now = Date.now();
  const current = rateLimitStore.get(key);
  if (!current || now >= current.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return false;
  }

  if (current.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return true;
  }

  current.count += 1;
  rateLimitStore.set(key, current);
  return false;
};

const maskLicenseKey = (licenseKey: string): string => {
  const compact = licenseKey.replace(/\s+/g, "").toUpperCase();
  if (compact.length <= 8) {
    return compact;
  }

  const head = compact.slice(0, 4);
  const tail = compact.slice(-4);
  return `${head}...${tail}`;
};

export async function POST(request: Request) {
  let body: ActivateRequestBody;
  try {
    body = (await request.json()) as ActivateRequestBody;
  } catch {
    return NextResponse.json<LicenseStatusResponse>(
      {
        configured: false,
        licensed: false,
        checkoutUrl: "https://muhamsyad.gumroad.com/l/mathend",
        reason: "invalid_payload",
        error: "Invalid request payload.",
      },
      { status: 400 },
    );
  }

  const runtime = getGumroadRuntimeConfig();
  if (!runtime.enabled) {
    return NextResponse.json<LicenseStatusResponse>(
      {
        configured: false,
        licensed: false,
        checkoutUrl: runtime.checkoutUrl,
        reason: "missing_product_id",
        error:
          "Gumroad product is not configured. Set GUMROAD_PRODUCT_ID on the server.",
      },
      { status: 500 },
    );
  }

  const secret = getLicenseSessionSecret();
  if (!secret) {
    return NextResponse.json<LicenseStatusResponse>(
      {
        configured: false,
        licensed: false,
        checkoutUrl: runtime.checkoutUrl,
        reason: "missing_cookie_secret",
        error:
          "License cookie secret is not configured. Set LICENSE_COOKIE_SECRET on the server.",
      },
      { status: 500 },
    );
  }

  const clientIp = resolveClientIp(request);
  const rateLimitKey = `${clientIp}:${runtime.productId}`;
  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json<LicenseStatusResponse>(
      {
        configured: true,
        licensed: false,
        checkoutUrl: runtime.checkoutUrl,
        reverifyDays: runtime.reverifyDays,
        reason: "rate_limited",
        error: "Too many activation attempts. Please wait a few minutes.",
      },
      { status: 429 },
    );
  }

  const licenseKey = (body.licenseKey ?? "").trim();
  const emailInput = (body.email ?? "").trim().toLowerCase();
  if (!licenseKey) {
    return NextResponse.json<LicenseStatusResponse>(
      {
        configured: true,
        licensed: false,
        checkoutUrl: runtime.checkoutUrl,
        reason: "missing_license_key",
        error: "License key is required.",
      },
      { status: 400 },
    );
  }

  const verification = await verifyGumroadLicense({
    productId: runtime.productId,
    apiBase: runtime.apiBase,
    licenseKey,
    incrementUsesCount: false,
  });

  if (!verification.ok) {
    return NextResponse.json<LicenseStatusResponse>(
      {
        configured: true,
        licensed: false,
        checkoutUrl: runtime.checkoutUrl,
        reverifyDays: runtime.reverifyDays,
        reason: verification.reason,
        error: verification.message,
      },
      { status: verification.reason === "network" ? 502 : 401 },
    );
  }

  const buyerEmail = (verification.purchase.email ?? "").trim().toLowerCase();
  if (emailInput && buyerEmail && emailInput !== buyerEmail) {
    return NextResponse.json<LicenseStatusResponse>(
      {
        configured: true,
        licensed: false,
        checkoutUrl: runtime.checkoutUrl,
        reverifyDays: runtime.reverifyDays,
        reason: "email_mismatch",
        error:
          "Purchase email does not match this license key. Use the same email from your Gumroad receipt.",
      },
      { status: 401 },
    );
  }

  const nowIso = new Date().toISOString();
  const sessionPayload: LicenseSessionPayload = {
    version: 1,
    productId: runtime.productId,
    checkoutUrl: runtime.checkoutUrl,
    licenseKey,
    licenseKeyPreview: maskLicenseKey(licenseKey),
    buyerEmail: buyerEmail || emailInput || "unknown@buyer.local",
    saleId: verification.saleId,
    activatedAt: nowIso,
    lastVerifiedAt: nowIso,
  };

  const token = signLicenseSession(sessionPayload, secret);

  const response = NextResponse.json<LicenseStatusResponse>({
    configured: true,
    licensed: true,
    checkoutUrl: runtime.checkoutUrl,
    productId: runtime.productId,
    buyerEmail: sessionPayload.buyerEmail,
    licenseKeyPreview: sessionPayload.licenseKeyPreview,
    activatedAt: sessionPayload.activatedAt,
    lastVerifiedAt: sessionPayload.lastVerifiedAt,
    reverifyDays: runtime.reverifyDays,
  });

  response.cookies.set({
    name: LICENSE_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });

  return response;
}
