import { NextResponse } from "next/server";
import { walgreensEnabled, wgPost } from "@/lib/walgreens";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { loadApi } from "@/lib/data/api";

export const runtime = "nodejs";

// Catalog of photo products (sizes + live prices). Call before every render.
// Returns a Resource envelope: missing creds / upstream errors degrade to an
// empty catalog (the UI falls back to download) instead of throwing.
export async function POST(req: Request) {
  const rl = await rateLimit(`print:${clientIp(req)}`, { limit: 60, windowSec: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests — please slow down." }, { status: 429 });

  let productGroupId: string | undefined;
  try {
    productGroupId = (await req.json())?.productGroupId;
  } catch {
    /* optional body */
  }

  const res = await loadApi<{ products?: unknown[] }>(
    async () => {
      const r = await wgPost("/api/photo/products/v3", {
        act: "getphotoprods",
        ...(productGroupId ? { productGroupId } : {}),
      });
      if (!r.ok) throw new Error("Service unavailable");
      return r.json;
    },
    { source: "Walgreens Native Photo", enabled: walgreensEnabled, fallback: { products: [] } },
  );

  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
