import { NextResponse } from "next/server";
import { listAssets, s3Configured } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!s3Configured) return NextResponse.json({ items: [], configured: false });
  try {
    return NextResponse.json({ items: await listAssets(), configured: true });
  } catch (err) {
    return NextResponse.json({ items: [], configured: true, error: String(err) }, { status: 502 });
  }
}
