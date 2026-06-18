import { NextResponse } from "next/server";
import { walgreensEnabled, wgPost } from "@/lib/walgreens";

export const runtime = "nodejs";

// Poll order status by vendorOrderId(s): Submitting → Downloading → Ready for
// Pickup → Sold.
export async function POST(req: Request) {
  if (!walgreensEnabled) return NextResponse.json({ configured: false, statuses: [] });
  const body = await req.json().catch(() => ({}));
  const orders = body?.orders;
  if (!Array.isArray(orders) || !orders.length) {
    return NextResponse.json({ error: "orders[] is required" }, { status: 400 });
  }
  const r = await wgPost("/api/photo/order/status/v3", { act: "orderstatus", orders });
  return NextResponse.json({ configured: true, ...(r.json as object) }, { status: r.ok ? 200 : 502 });
}
