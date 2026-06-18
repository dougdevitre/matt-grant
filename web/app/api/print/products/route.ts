import { NextResponse } from "next/server";
import { walgreensEnabled, wgPost } from "@/lib/walgreens";

export const runtime = "nodejs";

// Catalog of photo products (sizes + live prices). Call before every render.
export async function POST(req: Request) {
  if (!walgreensEnabled) {
    return NextResponse.json({ configured: false, products: [] });
  }
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
  return NextResponse.json({ configured: true, ...(r.json as object) }, { status: r.ok ? 200 : 502 });
}
