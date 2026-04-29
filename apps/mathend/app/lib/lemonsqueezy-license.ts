const readEnv = (name: string): string => process.env[name]?.trim() ?? "";

export type LemonSqueezyPurchase = {
  email?: string;
  status?: string;
  product_id?: string;
  order_id?: string;
  order_item_id?: string;
  license_key_id?: string;
};

type LemonSqueezyLicenseKey = {
  id?: string | number;
  status?: string;
};

type LemonSqueezyLicenseMeta = {
  product_id?: string | number;
  order_id?: string | number;
  order_item_id?: string | number;
  customer_email?: string;
};

type LemonSqueezyLicenseValidateResponse = {
  valid?: boolean;
  error?: string | null;
  license_key?: LemonSqueezyLicenseKey | null;
  meta?: LemonSqueezyLicenseMeta | null;
};

const parseJsonResponse = async <T>(response: Response): Promise<T | null> => {
  const raw = await response.text();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const normalizeApiBase = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "https://api.lemonsqueezy.com";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

const normalizeCheckoutUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "https://lemonsqueezy.com";
  }

  return trimmed;
};

export const getLemonSqueezyRuntimeConfig = (): {
  productId: string;
  apiBase: string;
  checkoutUrl: string;
  reverifyDays: number;
  enabled: boolean;
} => {
  const productId = readEnv("LEMONSQUEEZY_PRODUCT_ID");
  const apiBase = normalizeApiBase(readEnv("LEMONSQUEEZY_API_BASE"));
  const checkoutUrl = normalizeCheckoutUrl(
    readEnv("LEMONSQUEEZY_CHECKOUT_URL"),
  );
  const reverifyDaysRaw = Number(readEnv("LICENSE_REVERIFY_DAYS"));
  const reverifyDays =
    Number.isFinite(reverifyDaysRaw) && reverifyDaysRaw > 0
      ? Math.floor(reverifyDaysRaw)
      : 7;

  return {
    productId,
    apiBase,
    checkoutUrl,
    reverifyDays,
    enabled: Boolean(productId),
  };
};

const normalizeLicenseStatus = (value: string | undefined): string => {
  return value?.trim().toLowerCase() ?? "";
};

const toIdString = (value: string | number | undefined): string => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return "";
};

const resolveSaleId = (
  payload: LemonSqueezyLicenseValidateResponse,
): string => {
  const orderItemId = toIdString(payload.meta?.order_item_id ?? undefined);
  if (orderItemId) {
    return orderItemId;
  }

  const orderId = toIdString(payload.meta?.order_id ?? undefined);
  if (orderId) {
    return orderId;
  }

  const licenseKeyId = toIdString(payload.license_key?.id ?? undefined);
  if (licenseKeyId) {
    return licenseKeyId;
  }

  return "";
};

export const verifyLemonSqueezyLicense = async (params: {
  productId: string;
  apiBase: string;
  licenseKey: string;
  incrementUsesCount?: boolean;
}): Promise<
  | {
      ok: true;
      purchase: LemonSqueezyPurchase;
      saleId: string;
    }
  | {
      ok: false;
      reason: "invalid" | "revoked" | "network";
      message: string;
      status?: number;
    }
> => {
  const body = new URLSearchParams();
  body.set("license_key", params.licenseKey);

  const endpoint = `${params.apiBase}/v1/licenses/validate`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      reason: "network",
      message: "Could not reach Lemon Squeezy license API.",
    };
  }

  const payload =
    await parseJsonResponse<LemonSqueezyLicenseValidateResponse>(response);

  if (!response.ok || payload?.valid !== true || !payload.license_key) {
    return {
      ok: false,
      reason: "invalid",
      message: payload?.error ?? "License key is invalid for this product.",
      status: response.status,
    };
  }

  const licenseStatus = normalizeLicenseStatus(payload.license_key.status);
  if (licenseStatus === "disabled" || licenseStatus === "expired") {
    return {
      ok: false,
      reason: "revoked",
      message:
        "License access is unavailable because this Lemon Squeezy license is disabled or expired.",
      status: response.status,
    };
  }

  const verifiedProductId = toIdString(payload.meta?.product_id ?? undefined);
  if (!verifiedProductId) {
    return {
      ok: false,
      reason: "invalid",
      message: "Lemon Squeezy validation did not include a product id.",
      status: response.status,
    };
  }

  if (verifiedProductId !== params.productId.trim()) {
    return {
      ok: false,
      reason: "invalid",
      message: "License key is invalid for this product.",
      status: response.status,
    };
  }

  const saleId = resolveSaleId(payload);
  if (!saleId) {
    return {
      ok: false,
      reason: "invalid",
      message:
        "Lemon Squeezy validation did not include a stable order identifier.",
      status: response.status,
    };
  }

  const purchase: LemonSqueezyPurchase = {
    email:
      (payload.meta?.customer_email ?? "").trim().toLowerCase() || undefined,
    status: licenseStatus || undefined,
    product_id: verifiedProductId,
    order_id: toIdString(payload.meta?.order_id ?? undefined) || undefined,
    order_item_id:
      toIdString(payload.meta?.order_item_id ?? undefined) || undefined,
    license_key_id:
      toIdString(payload.license_key.id ?? undefined) || undefined,
  };

  return {
    ok: true,
    purchase,
    saleId,
  };
};
