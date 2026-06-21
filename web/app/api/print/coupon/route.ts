import { NextResponse } from "next/server";
import { walgreensEnabled, wgPost } from "@/lib/walgreens";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Validate a partner coupon and return the discount. Only attach couponCode to
// an order after it validates here.
export async function POST(req: Request) {
  if (!walgreensEnabled) return NextResponse.json({ configured: false });
  const rl = await rateLimit(`print:${clientIp(req)}`, { limit: 60, windowSec: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests — please slow down." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const { couponCode, productDetails } = body ?? {};
  if (!couponCode || !Array.isArray(productDetails) || !productDetails.length) {
    return NextResponse.json({ error: "couponCode and productDetails are required" }, { status: 400 });
  }
  const r = await wgPost("/api/photo/order/coupon/v3", {
    act: "getdiscount",
    couponCode,
    productDetails,
  });
  if (!r.ok) return NextResponse.json({ configured: true, error: "Service unavailable" }, { status: 502 });
  return NextResponse.json({ configured: true, ...(r.json as object) });
}
