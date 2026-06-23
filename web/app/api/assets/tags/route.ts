import { NextResponse } from "next/server";
import { setAssetTags, type AssetKind } from "@/lib/assets";
import { staffGate } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Set the tag list for one asset. Upserts the metadata record, so a legacy asset
// (uploaded before the metadata store existed) gets one from the fallback fields
// the client already knows. Staff-gated, same as the rest of /api/assets.
export async function POST(req: Request) {
  if (!(await staffGate()).ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: { key?: unknown; tags?: unknown; name?: unknown; contentType?: unknown; visibility?: unknown; size?: unknown; kind?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const key = typeof body.key === "string" ? body.key : "";
  if (!/^(public|private)\/.+/.test(key)) return NextResponse.json({ error: "bad key" }, { status: 400 });
  const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];

  const saved = await setAssetTags(key, tags, {
    name: typeof body.name === "string" ? body.name : undefined,
    contentType: typeof body.contentType === "string" ? body.contentType : undefined,
    visibility: body.visibility === "private" ? "private" : body.visibility === "public" ? "public" : undefined,
    size: typeof body.size === "number" ? body.size : undefined,
    kind: typeof body.kind === "string" ? (body.kind as AssetKind) : undefined,
  });
  return NextResponse.json({ key, tags: saved });
}
