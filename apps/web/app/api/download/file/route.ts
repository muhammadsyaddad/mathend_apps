import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getDownloadArtifactByPlatform,
  getDownloadRuntimeConfig,
  parseDownloadPlatform,
  parseDownloadToken,
} from "../../../lib/download-runtime";
import { getLemonSqueezyRuntimeConfig } from "../../../lib/lemonsqueezy-license";
import {
  getLicenseSessionSecret,
  parseSignedLicenseSession,
} from "../../../lib/license-session";
import { LICENSE_SESSION_COOKIE } from "../../../lib/license-types";

export const runtime = "nodejs";

const jsonError = (status: number, reason: string, message: string) => {
  return NextResponse.json(
    {
      ok: false,
      reason,
      error: message,
    },
    { status },
  );
};

const setPrivateNoStore = (response: NextResponse): NextResponse => {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
};

const toSafeHeaderFileName = (value: string): string => {
  const sanitized = value.replace(/[^A-Za-z0-9._-]/g, "_").trim();
  if (!sanitized) {
    return "mathend-desktop-installer";
  }
  return sanitized;
};

const isGitHubReleaseAssetUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== "api.github.com") {
      return false;
    }

    return /^\/repos\/[^/]+\/[^/]+\/releases\/assets\/\d+$/.test(
      parsed.pathname,
    );
  } catch {
    return false;
  }
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const platformValue = requestUrl.searchParams.get("platform")?.trim() ?? "";
  const token = requestUrl.searchParams.get("token")?.trim();

  const platform = parseDownloadPlatform(platformValue);
  if (!platform) {
    return setPrivateNoStore(
      jsonError(400, "invalid_platform", "Invalid download platform."),
    );
  }

  if (!token) {
    return setPrivateNoStore(
      jsonError(401, "missing_token", "Download token is required."),
    );
  }

  const runtime = getLemonSqueezyRuntimeConfig();
  if (!runtime.enabled) {
    return setPrivateNoStore(
      jsonError(
        500,
        "missing_product_id",
        "Download gate is not configured. Missing LEMONSQUEEZY_PRODUCT_ID.",
      ),
    );
  }

  const sessionSecret = getLicenseSessionSecret();
  if (!sessionSecret) {
    return setPrivateNoStore(
      jsonError(
        500,
        "missing_cookie_secret",
        "Download gate is not configured. Missing LICENSE_COOKIE_SECRET.",
      ),
    );
  }

  const downloadRuntime = getDownloadRuntimeConfig();
  if (!downloadRuntime.tokenSecret) {
    return setPrivateNoStore(
      jsonError(
        500,
        "missing_download_token_secret",
        "Download token secret is missing.",
      ),
    );
  }

  const parsedToken = parseDownloadToken(token, downloadRuntime.tokenSecret);
  if (!parsedToken) {
    return setPrivateNoStore(
      jsonError(401, "invalid_token", "Download token is invalid or expired."),
    );
  }

  if (parsedToken.platform !== platform) {
    return setPrivateNoStore(
      jsonError(
        401,
        "token_platform_mismatch",
        "Download token is not valid for this platform.",
      ),
    );
  }

  const artifact = getDownloadArtifactByPlatform(
    downloadRuntime.artifacts,
    platform,
  );
  if (!artifact) {
    return setPrivateNoStore(
      jsonError(
        404,
        "artifact_not_found",
        "Installer for selected platform is not configured.",
      ),
    );
  }

  const cookieStore = await cookies();
  const rawLicenseToken = cookieStore.get(LICENSE_SESSION_COOKIE)?.value;
  const licenseSession = parseSignedLicenseSession(
    rawLicenseToken,
    sessionSecret,
  );
  if (!licenseSession) {
    return setPrivateNoStore(
      jsonError(
        401,
        "missing_session",
        "You need an active license session to download this installer.",
      ),
    );
  }

  if (licenseSession.productId !== runtime.productId) {
    return setPrivateNoStore(
      jsonError(
        401,
        "product_mismatch",
        "Current license session does not match this product.",
      ),
    );
  }

  if (licenseSession.saleId !== parsedToken.saleId) {
    return setPrivateNoStore(
      jsonError(
        401,
        "sale_mismatch",
        "Download token does not match your license session.",
      ),
    );
  }

  let upstream: Response;
  const upstreamHeaders = new Headers();
  if (downloadRuntime.upstreamBearerToken) {
    upstreamHeaders.set(
      "Authorization",
      `Bearer ${downloadRuntime.upstreamBearerToken}`,
    );
  }

  if (isGitHubReleaseAssetUrl(artifact.url)) {
    upstreamHeaders.set("Accept", "application/octet-stream");
    upstreamHeaders.set("User-Agent", "mathend-download-gate");
    upstreamHeaders.set("X-GitHub-Api-Version", "2022-11-28");
  }

  try {
    upstream = await fetch(artifact.url, {
      headers: upstreamHeaders,
      cache: "no-store",
      redirect: "follow",
    });
  } catch {
    return setPrivateNoStore(
      jsonError(
        502,
        "upstream_unreachable",
        "Installer origin is temporarily unreachable. Please try again.",
      ),
    );
  }

  if (!upstream.ok || !upstream.body) {
    return setPrivateNoStore(
      jsonError(
        502,
        "upstream_invalid_response",
        "Installer origin returned an invalid response.",
      ),
    );
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("Content-Type") ?? "application/octet-stream",
  );
  headers.set(
    "Content-Disposition",
    `attachment; filename="${toSafeHeaderFileName(artifact.fileName)}"`,
  );
  headers.set("Cache-Control", "private, no-store, max-age=0");

  const contentLength = upstream.headers.get("Content-Length");
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  });
}
