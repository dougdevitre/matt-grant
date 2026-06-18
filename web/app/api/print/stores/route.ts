import { NextResponse } from "next/server";
import { walgreensEnabled, wgPost } from "@/lib/walgreens";

export const runtime = "nodejs";

// Nearby Walgreens that can fulfill the current cart, with pickup promise times.
export async function POST(req: Request) {
  if (!walgreensEnabled) return NextResponse.json({ configured: false, photoStores: [] });
  const body = await req.json().catch(() => ({}));
  const { latitude, longitude, productDetails } = body ?? {};
  if (!latitude || !longitude || !Array.isArray(productDetails) || !productDetails.length) {
    return NextResponse.json({ error: "latitude, longitude, and productDetails are required" }, { status: 400 });
  }
  const r = await wgPost("/api/photo/store/v3", {
    act: "photoStores",
    latitude: String(latitude),
    longitude: String(longitude),
    productDetails,
  });
  return NextResponse.json({ configured: true, ...(r.json as object) }, { status: r.ok ? 200 : 502 });
}
