import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getLemonSqueezyRuntimeConfig,
  verifyLemonSqueezyLicense,
} from "../../../lib/lemonsqueezy-license";
import {
  getLicenseSessionSecret,
  parseSignedLicenseSession,
  signLicenseSession,
} from "../../../lib/license-session";
import {
  LICENSE_SESSION_COOKIE,
  type LicenseSessionPayload,
  type LicenseStatusResponse,
} from "../../../lib/license-types";

const DAY_MS = 24 * 60 * 60 * 1000;

const clearLicenseCookie = (response: NextResponse): void => {
  response.cookies.set({
    name: LICENSE_SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
};

const buildLicensedResponse = (
  payload: LicenseSessionPayload,
  runtime: ReturnType<typeof getLemonSqueezyRuntimeConfig>,
): LicenseStatusResponse => {
  return {
    configured: true,
    licensed: true,
    checkoutUrl: runtime.checkoutUrl,
    productId: payload.productId,
    buyerEmail: payload.buyerEmail,
    licenseKeyPreview: payload.licenseKeyPreview,
    activatedAt: payload.activatedAt,
    lastVerifiedAt: payload.lastVerifiedAt,
    reverifyDays: runtime.reverifyDays,
  };
};

export async function GET(request: Request) {
  const runtime = getLemonSqueezyRuntimeConfig();
  if (!runtime.enabled) {
    return NextResponse.json<LicenseStatusResponse>({
      configured: false,
      licensed: false,
      checkoutUrl: runtime.checkoutUrl,
      reason: "missing_product_id",
      error:
        "Lemon Squeezy product is not configured. Set LEMONSQUEEZY_PRODUCT_ID on the server.",
    });
  }

  const secret = getLicenseSessionSecret();
  if (!secret) {
    return NextResponse.json<LicenseStatusResponse>({
      configured: false,
      licensed: false,
      checkoutUrl: runtime.checkoutUrl,
      reason: "missing_cookie_secret",
      error:
        "License cookie secret is not configured. Set LICENSE_COOKIE_SECRET on the server.",
    });
  }

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(LICENSE_SESSION_COOKIE)?.value;
  const session = parseSignedLicenseSession(rawToken, secret);
  if (!session) {
    return NextResponse.json<LicenseStatusResponse>({
      configured: true,
      licensed: false,
      checkoutUrl: runtime.checkoutUrl,
      reverifyDays: runtime.reverifyDays,
      // if there is no buy yet
      reason: "missing_session",
    });
  }

  const lastVerifiedAtMs = Date.parse(session.lastVerifiedAt);
  const shouldReverify =
    !Number.isFinite(lastVerifiedAtMs) ||
    Date.now() - lastVerifiedAtMs >= runtime.reverifyDays * DAY_MS;

  if (!shouldReverify) {
    return NextResponse.json<LicenseStatusResponse>(
      buildLicensedResponse(session, runtime),
    );
  }

  const verification = await verifyLemonSqueezyLicense({
    productId: runtime.productId,
    apiBase: runtime.apiBase,
    licenseKey: session.licenseKey,
    incrementUsesCount: false,
  });

  if (!verification.ok) {
    if (verification.reason === "network") {
      return NextResponse.json<LicenseStatusResponse>({
        ...buildLicensedResponse(session, runtime),
        reason: "network_reverify_failed",
        error:
          "Using cached license status because Lemon Squeezy verification is temporarily unavailable.",
      });
    }

    const response = NextResponse.json<LicenseStatusResponse>(
      {
        configured: true,
        licensed: false,
        checkoutUrl: runtime.checkoutUrl,
        reverifyDays: runtime.reverifyDays,
        reason: verification.reason,
        error: verification.message,
      },
      { status: 401 },
    );
    clearLicenseCookie(response);
    return response;
  }

  const refreshedSession: LicenseSessionPayload = {
    ...session,
    buyerEmail:
      (verification.purchase.email ?? "").trim() || session.buyerEmail,
    saleId: verification.saleId,
    lastVerifiedAt: new Date().toISOString(),
  };

  const token = signLicenseSession(refreshedSession, secret);
  const response = NextResponse.json<LicenseStatusResponse>(
    buildLicensedResponse(refreshedSession, runtime),
  );

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
