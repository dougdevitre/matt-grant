import { NextResponse } from "next/server";
import { listPhotos, s3Configured } from "@/lib/s3";
import { checkCap } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Protected by middleware (/api/assets(.*)). Returns the private photo library
// grouped by category, each with a short-lived signed URL.
export async function GET() {
  if (!(await checkCap("manageAssets")).allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!s3Configured) return NextResponse.json({ groups: [], configured: false });
  try {
    return NextResponse.json({ groups: await listPhotos(), configured: true });
  } catch (err) {
    return NextResponse.json({ groups: [], configured: true, error: String(err) }, { status: 502 });
  }
}
