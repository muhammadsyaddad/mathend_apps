import { createHmac, timingSafeEqual } from "node:crypto";

const readEnv = (name: string): string => process.env[name]?.trim() ?? "";

const DOWNLOAD_PLATFORMS = ["windows", "macos", "linux"] as const;
const DEFAULT_DOWNLOAD_TOKEN_TTL_SECONDS = 300;

export type DownloadPlatform = (typeof DOWNLOAD_PLATFORMS)[number];

export type DownloadArtifact = {
  platform: DownloadPlatform;
  label: string;
  fileName: string;
  url: string;
};

type DownloadTokenPayload = {
  version: 1;
  platform: DownloadPlatform;
  saleId: string;
  exp: number;
};

const platformLabels: Record<DownloadPlatform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

const normalizeDownloadUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
};

const sanitizeFileName = (value: string): string => {
  return value.replace(/[\\/\r\n\t]/g, "_").trim();
};

const inferFileNameFromUrl = (
  url: string,
  platform: DownloadPlatform,
): string => {
  try {
    const parsed = new URL(url);
    const basename = parsed.pathname.split("/").filter(Boolean).pop();
    if (!basename) {
      return `mathend-desktop-${platform}`;
    }

    const decoded = decodeURIComponent(basename).trim();
    if (!decoded) {
      return `mathend-desktop-${platform}`;
    }

    return sanitizeFileName(decoded);
  } catch {
    return `mathend-desktop-${platform}`;
  }
};

const toPositiveInt = (value: string, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

const resolveTokenSecret = (): string => {
  const explicit = readEnv("WEB_DOWNLOAD_TOKEN_SECRET");
  if (explicit) {
    return explicit;
  }
  return readEnv("LICENSE_COOKIE_SECRET");
};

const getArtifact = (platform: DownloadPlatform): DownloadArtifact | null => {
  const url = normalizeDownloadUrl(
    readEnv(`WEB_DOWNLOAD_${platform.toUpperCase()}_URL`),
  );
  if (!url) {
    return null;
  }

  const configuredName = sanitizeFileName(
    readEnv(`WEB_DOWNLOAD_${platform.toUpperCase()}_FILENAME`),
  );
  const fileName = configuredName || inferFileNameFromUrl(url, platform);

  return {
    platform,
    label: platformLabels[platform],
    fileName,
    url,
  };
};

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

const isDownloadPlatform = (value: string): value is DownloadPlatform => {
  return (DOWNLOAD_PLATFORMS as readonly string[]).includes(value);
};

const isDownloadTokenPayload = (
  candidate: unknown,
): candidate is DownloadTokenPayload => {
  if (typeof candidate !== "object" || candidate === null) {
    return false;
  }

  const payload = candidate as Partial<DownloadTokenPayload>;
  return (
    payload.version === 1 &&
    typeof payload.platform === "string" &&
    isDownloadPlatform(payload.platform) &&
    typeof payload.saleId === "string" &&
    payload.saleId.length > 0 &&
    typeof payload.exp === "number" &&
    Number.isFinite(payload.exp)
  );
};

export const getDownloadRuntimeConfig = (): {
  artifacts: DownloadArtifact[];
  tokenSecret: string;
  tokenTtlSeconds: number;
  upstreamBearerToken: string;
} => {
  const artifacts = DOWNLOAD_PLATFORMS.map((platform) =>
    getArtifact(platform),
  ).filter((artifact): artifact is DownloadArtifact => artifact !== null);

  const tokenSecret = resolveTokenSecret();
  const rawTokenTtlSeconds = toPositiveInt(
    readEnv("WEB_DOWNLOAD_TOKEN_TTL_SECONDS"),
    DEFAULT_DOWNLOAD_TOKEN_TTL_SECONDS,
  );
  const tokenTtlSeconds = Math.max(30, Math.min(rawTokenTtlSeconds, 3600));
  const upstreamBearerToken = readEnv("WEB_DOWNLOAD_UPSTREAM_BEARER_TOKEN");

  return {
    artifacts,
    tokenSecret,
    tokenTtlSeconds,
    upstreamBearerToken,
  };
};

export const getDownloadArtifactByPlatform = (
  artifacts: DownloadArtifact[],
  platform: DownloadPlatform,
): DownloadArtifact | null => {
  return artifacts.find((artifact) => artifact.platform === platform) ?? null;
};

export const createDownloadToken = (params: {
  platform: DownloadPlatform;
  saleId: string;
  secret: string;
  ttlSeconds: number;
  nowMs?: number;
}): {
  token: string;
  expiresAt: string;
} => {
  const nowMs = params.nowMs ?? Date.now();
  const exp = Math.floor(nowMs / 1000) + Math.max(30, params.ttlSeconds);
  const payload: DownloadTokenPayload = {
    version: 1,
    platform: params.platform,
    saleId: params.saleId,
    exp,
  };

  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadSegment, params.secret);
  return {
    token: `${payloadSegment}.${signature}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
};

export const parseDownloadToken = (
  token: string | undefined,
  secret: string,
  nowMs: number = Date.now(),
): DownloadTokenPayload | null => {
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
    if (!isDownloadTokenPayload(parsed)) {
      return null;
    }

    const nowSeconds = Math.floor(nowMs / 1000);
    if (parsed.exp <= nowSeconds) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const parseDownloadPlatform = (
  value: string,
): DownloadPlatform | null => {
  if (!isDownloadPlatform(value)) {
    return null;
  }
  return value;
};
