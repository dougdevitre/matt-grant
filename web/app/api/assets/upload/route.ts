import { NextResponse } from "next/server";
import { uploadObject, keyFor, publicUrl, s3Configured, type Visibility } from "@/lib/s3";
import { staffGate } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB — campaign images/PDFs, not video
// SVG is intentionally excluded — it can carry script and these are CDN-public.
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);

export async function POST(req: Request) {
  if (!(await staffGate()).ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!s3Configured) return NextResponse.json({ error: "S3 not configured (set S3_ASSETS_BUCKET)" }, { status: 503 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (15 MB max)" }, { status: 413 });
  }
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: `Unsupported file type: ${contentType}` }, { status: 415 });
  }
  const visibility: Visibility = form.get("visibility") === "private" ? "private" : "public";
  const key = keyFor(visibility, file.name);
  try {
    await uploadObject(key, Buffer.from(await file.arrayBuffer()), contentType);
    return NextResponse.json({ key, visibility, url: visibility === "public" ? publicUrl(key) : null });
  } catch (err) {
    console.error("[assets/upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }
}
