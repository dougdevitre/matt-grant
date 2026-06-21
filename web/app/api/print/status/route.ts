import { NextResponse } from "next/server";
import { walgreensEnabled, wgPost } from "@/lib/walgreens";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Poll order status by vendorOrderId(s): Submitting → Downloading → Ready for
// Pickup → Sold.
export async function POST(req: Request) {
  if (!walgreensEnabled) return NextResponse.json({ configured: false, statuses: [] });
  const rl = await rateLimit(`print:${clientIp(req)}`, { limit: 60, windowSec: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests — please slow down." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const orders = body?.orders;
  if (!Array.isArray(orders) || !orders.length) {
    return NextResponse.json({ error: "orders[] is required" }, { status: 400 });
  }
  const r = await wgPost("/api/photo/order/status/v3", { act: "orderstatus", orders });
  if (!r.ok) return NextResponse.json({ configured: true, error: "Service unavailable" }, { status: 502 });
  return NextResponse.json({ configured: true, ...(r.json as object) });
}
