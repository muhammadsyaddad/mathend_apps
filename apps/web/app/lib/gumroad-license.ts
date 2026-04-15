const readEnv = (name: string): string => process.env[name]?.trim() ?? "";

export type GumroadPurchase = {
  product_id?: string;
  product_name?: string;
  email?: string;
  sale_id?: string;
  id?: string;
  license_key?: string;
  refunded?: boolean;
  disputed?: boolean;
  chargebacked?: boolean;
};

type GumroadLicenseVerifyResponse = {
  success?: boolean;
  purchase?: GumroadPurchase;
  message?: string;
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
    return "https://api.gumroad.com";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

const normalizeCheckoutUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "https://muhamsyad.gumroad.com/l/mathend";
  }

  return trimmed;
};

export const getGumroadRuntimeConfig = (): {
  productId: string;
  apiBase: string;
  checkoutUrl: string;
  reverifyDays: number;
  enabled: boolean;
} => {
  const productId = readEnv("GUMROAD_PRODUCT_ID");
  const apiBase = normalizeApiBase(readEnv("GUMROAD_API_BASE"));
  const checkoutUrl = normalizeCheckoutUrl(readEnv("GUMROAD_CHECKOUT_URL"));
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

const resolveSaleId = (purchase: GumroadPurchase): string => {
  if (
    typeof purchase.sale_id === "string" &&
    purchase.sale_id.trim().length > 0
  ) {
    return purchase.sale_id.trim();
  }
  if (typeof purchase.id === "string" && purchase.id.trim().length > 0) {
    return purchase.id.trim();
  }
  return "";
};

export const verifyGumroadLicense = async (params: {
  productId: string;
  apiBase: string;
  licenseKey: string;
  incrementUsesCount?: boolean;
}): Promise<
  | {
      ok: true;
      purchase: GumroadPurchase;
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
  body.set("product_id", params.productId);
  body.set("license_key", params.licenseKey);
  body.set(
    "increment_uses_count",
    params.incrementUsesCount === true ? "true" : "false",
  );

  const endpoint = `${params.apiBase}/v2/licenses/verify`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      reason: "network",
      message: "Could not reach Gumroad license API.",
    };
  }

  const payload =
    await parseJsonResponse<GumroadLicenseVerifyResponse>(response);

  if (!response.ok || payload?.success !== true || !payload.purchase) {
    return {
      ok: false,
      reason: "invalid",
      message: payload?.message ?? "License key is invalid for this product.",
      status: response.status,
    };
  }

  const purchase = payload.purchase;
  if (purchase.refunded || purchase.disputed || purchase.chargebacked) {
    return {
      ok: false,
      reason: "revoked",
      message:
        "License access is unavailable because purchase is refunded or disputed.",
      status: response.status,
    };
  }

  const saleId = resolveSaleId(purchase);
  if (!saleId) {
    return {
      ok: false,
      reason: "invalid",
      message: "Gumroad verification did not include a valid sale id.",
      status: response.status,
    };
  }

  return {
    ok: true,
    purchase,
    saleId,
  };
};
