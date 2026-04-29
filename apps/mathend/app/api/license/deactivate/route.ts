import { NextResponse } from "next/server";
import { getLemonSqueezyRuntimeConfig } from "../../../lib/lemonsqueezy-license";
import {
  LICENSE_SESSION_COOKIE,
  type LicenseStatusResponse,
} from "../../../lib/license-types";

export async function POST() {
  const runtime = getLemonSqueezyRuntimeConfig();

  const response = NextResponse.json<LicenseStatusResponse>({
    configured: runtime.enabled,
    licensed: false,
    checkoutUrl: runtime.checkoutUrl,
    reverifyDays: runtime.reverifyDays,
    reason: "deactivated",
  });

  response.cookies.set({
    name: LICENSE_SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });

  return response;
}
