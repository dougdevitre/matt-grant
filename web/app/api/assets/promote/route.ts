import { NextResponse } from "next/server";
import { checkCap } from "@/lib/auth";
import { s3Configured } from "@/lib/s3";
import { promoteToPublicImage } from "@/lib/social/promoteMedia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Promote a private Photo-library image to a stable PUBLIC copy so it can be posted.
// Gated on manageSocial (admin-only) — publishing staff-only media publicly is more
// sensitive than a normal asset upload, and this is only ever driven from the Social
// Command Center composer. Protected by middleware (/api/assets(.*)) for sign-in.
export async function POST(req: Request) {
  const { allowed, gate } = await checkCap("manageSocial");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!s3Configured) return NextResponse.json({ error: "S3 not configured" }, { status: 503 });

  let key = "";
  try {
    const body = (await req.json()) as { key?: unknown };
    key = String(body?.key ?? "");
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!key.startsWith("private/")) {
    return NextResponse.json({ error: "Only private photos can be promoted" }, { status: 400 });
  }

  try {
    return NextResponse.json(await promoteToPublicImage(key, gate.email ?? undefined));
  } catch (err) {
    console.error("[api] assets/promote:", err); // log the real error server-side; don't leak it
    return NextResponse.json({ error: "Couldn't prepare that image" }, { status: 502 });
  }
}
