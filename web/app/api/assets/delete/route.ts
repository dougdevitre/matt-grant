import { NextResponse } from "next/server";
import { checkCap } from "@/lib/auth";
import { deleteObject, s3Configured } from "@/lib/s3";
import { deleteAssetMeta } from "@/lib/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Delete an asset from the library — the S3 object and its metadata record. Gated on
// manageAssets (the asset-management surface, same as upload/tags). Lets a promoted
// public/social copy be taken back down. Protected by middleware (/api/assets(.*)).
export async function POST(req: Request) {
  const { allowed } = await checkCap("manageAssets");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!s3Configured) return NextResponse.json({ error: "S3 not configured" }, { status: 503 });

  let key = "";
  try {
    const body = (await req.json()) as { key?: unknown };
    key = String(body?.key ?? "");
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  // Only library objects (public/ or private/) — never an empty or traversal key.
  if ((!key.startsWith("public/") && !key.startsWith("private/")) || key.includes("..")) {
    return NextResponse.json({ error: "Not a valid asset key" }, { status: 400 });
  }

  try {
    await deleteObject(key);
    await deleteAssetMeta(key); // best-effort; no-ops when the metadata table isn't configured
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    console.error("[api] assets/delete:", err); // log the real error server-side; don't leak it
    return NextResponse.json({ error: "Couldn't delete that asset" }, { status: 502 });
  }
}
