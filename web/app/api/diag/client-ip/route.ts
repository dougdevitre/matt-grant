import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Secret-gated diagnostic: report the real proxy-chain shape as the LIVE Amplify
// SSR edge presents it, so RATELIMIT_TRUSTED_PROXY_HOPS can be set to the hop
// where the true client IP actually appears. Amplify chains two CloudFront
// distributions, so the count is 1 or 2 and must be measured, not assumed — and
// CloudFront-Viewer-Address is not reliably exposed on Amplify, so we surface
// whatever address-ish headers ARE present in case a non-spoofable one exists.
//
// Usage from a known client IP (find yours at e.g. https://ifconfig.me):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/diag/client-ip
// Read `parts`: set RATELIMIT_TRUSTED_PROXY_HOPS to the `hopFromRight` of your
// real public IP (1 = last entry). If `chosenIp` already equals it, leave it at 1.
// Safe to delete this route once the hop count is confirmed.
export async function GET(req: Request) {
  if (!(await cronAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const xff = req.headers.get("x-forwarded-for") ?? "";
  const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);

  // Any header that might carry a trustworthy (edge-set, non-spoofable) client IP.
  const addressHeaders: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (/^cloudfront-viewer-address$|^true-client-ip$|^x-real-ip$|^cf-connecting-ip$/i.test(k)) {
      addressHeaders[k] = v;
    }
  });

  return NextResponse.json({
    rawXff: xff,
    parts: parts.map((ip, i) => ({ index: i, ip, hopFromRight: parts.length - i })),
    hopCountEnv: Number(process.env.RATELIMIT_TRUSTED_PROXY_HOPS) || 1,
    chosenIp: clientIp(req),
    otherAddressHeaders: addressHeaders,
    hint:
      "Set RATELIMIT_TRUSTED_PROXY_HOPS to the hopFromRight of your real public IP so chosenIp matches it. " +
      "If otherAddressHeaders contains an edge-set address (e.g. cloudfront-viewer-address), prefer that header instead.",
  });
}
