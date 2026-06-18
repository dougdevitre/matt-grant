import { NextResponse } from "next/server";
import { listPhotos, s3Configured } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Protected by middleware (/api/assets(.*)). Returns the private photo library
// grouped by category, each with a short-lived signed URL.
export async function GET() {
  if (!s3Configured) return NextResponse.json({ groups: [], configured: false });
  try {
    return NextResponse.json({ groups: await listPhotos(), configured: true });
  } catch (err) {
    return NextResponse.json({ groups: [], configured: true, error: String(err) }, { status: 502 });
  }
}
