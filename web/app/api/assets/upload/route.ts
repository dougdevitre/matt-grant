import { NextResponse } from "next/server";
import { uploadObject, keyFor, publicUrl, s3Configured, type Visibility } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!s3Configured) return NextResponse.json({ error: "S3 not configured (set S3_ASSETS_BUCKET)" }, { status: 503 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  const visibility: Visibility = form.get("visibility") === "private" ? "private" : "public";
  const key = keyFor(visibility, file.name);
  try {
    await uploadObject(key, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");
    return NextResponse.json({ key, visibility, url: visibility === "public" ? publicUrl(key) : null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
