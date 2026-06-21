import { NextResponse } from "next/server";
import { walgreensEnabled, wgPost } from "@/lib/walgreens";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Catalog of photo products (sizes + live prices). Call before every render.
export async function POST(req: Request) {
  if (!walgreensEnabled) {
    return NextResponse.json({ configured: false, products: [] });
  }
  const rl = await rateLimit(`print:${clientIp(req)}`, { limit: 60, windowSec: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests — please slow down." }, { status: 429 });
  let productGroupId: string | undefined;
  try {
    productGroupId = (await req.json())?.productGroupId;
  } catch {
    /* optional body */
  }
  const r = await wgPost("/api/photo/products/v3", {
    act: "getphotoprods",
    ...(productGroupId ? { productGroupId } : {}),
  });
  if (!r.ok) return NextResponse.json({ configured: true, error: "Service unavailable" }, { status: 502 });
  return NextResponse.json({ configured: true, ...(r.json as object) });
}
