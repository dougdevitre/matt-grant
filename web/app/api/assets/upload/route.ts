import { NextResponse } from "next/server";
import { uploadObject, keyFor, publicUrl, s3Configured, type Visibility } from "@/lib/s3";
import { optimizeImage } from "@/lib/images";
import { classifyKind, putAssetMeta } from "@/lib/assets";
import { checkCap } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB — campaign images/PDFs, not video
// SVG is intentionally excluded — it can carry script and these are CDN-public.
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);

export async function POST(req: Request) {
  const { allowed, gate } = await checkCap("manageAssets");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  // Optional caller-supplied tags (comma-separated) — e.g. the Graphics studio tags
  // its saves "studio" so the composer's picker can surface a Studio tab. putAssetMeta
  // dedupes/normalizes and caps the list.
  const tags = String(form.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const key = keyFor(visibility, file.name);

  // Optimize images for web by default (keep-format); "Original quality" sends optimize=0.
  const optimize = form.get("optimize") !== "0";
  const original = Buffer.from(await file.arrayBuffer());
  const originalSize = original.length;
  const { buffer, contentType: storedType } = optimize
    ? await optimizeImage(original, contentType)
    : { buffer: original, contentType };
  const size = buffer.length;

  try {
    await uploadObject(key, buffer, storedType, {
      cacheControl: visibility === "public" ? "public, max-age=31536000, immutable" : "private, no-store",
      metadata: {
        "orig-size": String(originalSize),
        "uploaded-by": gate.email ?? "",
        kind: classifyKind(file.name, storedType),
      },
    });
    await putAssetMeta({
      key,
      name: key.split("/").pop() ?? file.name,
      contentType: storedType,
      kind: classifyKind(file.name, storedType),
      visibility,
      size,
      originalSize,
      uploadedAt: new Date().toISOString(),
      uploadedBy: gate.email ?? undefined,
      tags,
    });
    const savedPct = originalSize > 0 ? Math.max(0, Math.round((1 - size / originalSize) * 100)) : 0;
    return NextResponse.json({
      key,
      visibility,
      url: visibility === "public" ? publicUrl(key) : null,
      size,
      originalSize,
      savedPct,
    });
  } catch (err) {
    console.error("[assets/upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }
}
