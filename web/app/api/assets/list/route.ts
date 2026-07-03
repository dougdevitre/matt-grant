import { NextResponse } from "next/server";
import { listAssets, s3Configured } from "@/lib/s3";
import { checkCap } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await checkCap("manageAssets")).allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!s3Configured) return NextResponse.json({ items: [], configured: false });
  try {
    return NextResponse.json({ items: await listAssets(), configured: true });
  } catch (err) {
    console.error("[api] assets/list:", err); // log the real error server-side; don't leak it
    return NextResponse.json({ items: [], configured: true, error: "Couldn't list assets" }, { status: 502 });
  }
}
