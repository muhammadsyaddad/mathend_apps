import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createDownloadToken,
  getDownloadRuntimeConfig,
} from "../../../lib/download-runtime";
import {
  getGumroadRuntimeConfig,
  verifyGumroadLicense,
} from "../../../lib/gumroad-license";
import {
  getLicenseSessionSecret,
  parseSignedLicenseSession,
  signLicenseSession,
} from "../../../lib/license-session";
import {
  LICENSE_SESSION_COOKIE,
  type LicenseSessionPayload,
} from "../../../lib/license-types";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

type DownloadCatalogItem = {
  platform: "windows" | "macos" | "linux";
  label: string;
  fileName: string;
  downloadPath: string;
  expiresAt: string;
};

type DownloadCatalogResponse = {
  configured: boolean;
  licensed: boolean;
  checkoutUrl: string;
  reason?: string;
  error?: string;
  warning?: string;
  productId?: string;
  buyerEmail?: string;
  licenseKeyPreview?: string;
  activatedAt?: string;
  lastVerifiedAt?: string;
  reverifyDays?: number;
  platforms?: DownloadCatalogItem[];
};

const clearLicenseCookie = (response: NextResponse): void => {
  response.cookies.set({
    name: LICENSE_SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
};

const unauthorized = (params: {
  checkoutUrl: string;
  reverifyDays?: number;
  reason: string;
  error: string;
  clear?: boolean;
}): NextResponse => {
  const response = NextResponse.json<DownloadCatalogResponse>(
    {
      configured: true,
      licensed: false,
      checkoutUrl: params.checkoutUrl,
      reverifyDays: params.reverifyDays,
      reason: params.reason,
      error: params.error,
    },
    { status: 401 },
  );

  if (params.clear) {
    clearLicenseCookie(response);
  }

  return response;
};

export async function GET(request: Request) {
  const runtime = getGumroadRuntimeConfig();
  if (!runtime.enabled) {
    return NextResponse.json<DownloadCatalogResponse>(
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
    return NextResponse.json<DownloadCatalogResponse>(
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

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(LICENSE_SESSION_COOKIE)?.value;
  const session = parseSignedLicenseSession(rawToken, secret);
  if (!session) {
    return unauthorized({
      checkoutUrl: runtime.checkoutUrl,
      reverifyDays: runtime.reverifyDays,
      reason: "missing_session",
      error: "License is required before downloading desktop installers.",
    });
  }

  if (session.productId !== runtime.productId) {
    return unauthorized({
      checkoutUrl: runtime.checkoutUrl,
      reverifyDays: runtime.reverifyDays,
      reason: "product_mismatch",
      error:
        "License session does not match current product configuration. Please activate your license again.",
      clear: true,
    });
  }

  let effectiveSession: LicenseSessionPayload = session;
  let refreshedToken: string | null = null;
  let warningMessage: string | undefined;

  const lastVerifiedAtMs = Date.parse(session.lastVerifiedAt);
  const shouldReverify =
    !Number.isFinite(lastVerifiedAtMs) ||
    Date.now() - lastVerifiedAtMs >= runtime.reverifyDays * DAY_MS;

  if (shouldReverify) {
    const verification = await verifyGumroadLicense({
      productId: runtime.productId,
      apiBase: runtime.apiBase,
      licenseKey: session.licenseKey,
      incrementUsesCount: false,
    });

    if (!verification.ok) {
      if (verification.reason !== "network") {
        return unauthorized({
          checkoutUrl: runtime.checkoutUrl,
          reverifyDays: runtime.reverifyDays,
          reason: verification.reason,
          error: verification.message,
          clear: true,
        });
      }

      warningMessage =
        "Gumroad re-verification is temporarily unavailable. Using cached license status.";
    } else {
      effectiveSession = {
        ...session,
        buyerEmail:
          (verification.purchase.email ?? "").trim() || session.buyerEmail,
        saleId: verification.saleId,
        lastVerifiedAt: new Date().toISOString(),
      };
      refreshedToken = signLicenseSession(effectiveSession, secret);
    }
  }

  const downloadRuntime = getDownloadRuntimeConfig();
  if (downloadRuntime.artifacts.length === 0) {
    return NextResponse.json<DownloadCatalogResponse>(
      {
        configured: true,
        licensed: true,
        checkoutUrl: runtime.checkoutUrl,
        reason: "missing_artifacts",
        error:
          "No desktop artifacts are configured. Set WEB_DOWNLOAD_<PLATFORM>_URL variables.",
      },
      { status: 500 },
    );
  }

  if (!downloadRuntime.tokenSecret) {
    return NextResponse.json<DownloadCatalogResponse>(
      {
        configured: true,
        licensed: true,
        checkoutUrl: runtime.checkoutUrl,
        reason: "missing_download_token_secret",
        error:
          "Download token secret is missing. Set WEB_DOWNLOAD_TOKEN_SECRET or LICENSE_COOKIE_SECRET.",
      },
      { status: 500 },
    );
  }

  const platforms = downloadRuntime.artifacts.map((artifact) => {
    const { token, expiresAt } = createDownloadToken({
      platform: artifact.platform,
      saleId: effectiveSession.saleId,
      secret: downloadRuntime.tokenSecret,
      ttlSeconds: downloadRuntime.tokenTtlSeconds,
    });

    return {
      platform: artifact.platform,
      label: artifact.label,
      fileName: artifact.fileName,
      downloadPath: `/api/download/file?platform=${artifact.platform}&token=${encodeURIComponent(token)}`,
      expiresAt,
    } satisfies DownloadCatalogItem;
  });

  const response = NextResponse.json<DownloadCatalogResponse>(
    {
      configured: true,
      licensed: true,
      checkoutUrl: runtime.checkoutUrl,
      warning: warningMessage,
      productId: effectiveSession.productId,
      buyerEmail: effectiveSession.buyerEmail,
      licenseKeyPreview: effectiveSession.licenseKeyPreview,
      activatedAt: effectiveSession.activatedAt,
      lastVerifiedAt: effectiveSession.lastVerifiedAt,
      reverifyDays: runtime.reverifyDays,
      platforms,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  if (refreshedToken) {
    response.cookies.set({
      name: LICENSE_SESSION_COOKIE,
      value: refreshedToken,
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }

  return response;
}
