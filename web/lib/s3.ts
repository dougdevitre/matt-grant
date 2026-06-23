import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { classifyKind, listAssetMeta, type AssetKind } from "@/lib/assets";

// S3 object assets. Public assets (brand, studio output) live under `public/`
// and are served via CloudFront; private assets (staff docs) under `private/`
// and are reached only through short-lived presigned URLs. Credentials come from
// the default AWS chain (IAM role on Amplify, AWS_* / profile locally).

export const BUCKET = process.env.S3_ASSETS_BUCKET ?? "";
export const CDN = (process.env.ASSETS_CDN_URL ?? "").replace(/\/$/, ""); // CloudFront base, no trailing slash
export const s3Configured = !!BUCKET;

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });

export type Visibility = "public" | "private";

export function keyFor(visibility: Visibility, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-80);
  return `${visibility}/${Date.now()}-${safe}`;
}

export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  opts: { cacheControl?: string; metadata?: Record<string, string> } = {},
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: opts.cacheControl,
      Metadata: opts.metadata,
    }),
  );
}

export function publicUrl(key: string): string {
  return CDN ? `${CDN}/${key}` : "";
}

export async function presignedGet(key: string, expiresIn = 900): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

export type AssetItem = {
  key: string;
  name: string;
  kind: AssetKind;
  size: number;
  lastModified: string;
  visibility: Visibility;
  url: string;
  tags: string[];
  uploadedBy?: string;
  originalSize?: number;
};

export type PhotoItem = { key: string; name: string; url: string; size: number; lastModified: string };
export const PHOTO_CATEGORIES = ["candidate", "family", "events", "district", "broll"] as const;

// Private photo library, grouped by category, each with a short-lived signed URL.
export async function listPhotos(): Promise<{ category: string; items: PhotoItem[] }[]> {
  const groups: { category: string; items: PhotoItem[] }[] = [];
  for (const category of PHOTO_CATEGORIES) {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `private/photos/${category}/`, MaxKeys: 500 }));
    const items: PhotoItem[] = [];
    for (const o of res.Contents ?? []) {
      if (!o.Key || !/\.(jpe?g|png|webp|heic|tiff?)$/i.test(o.Key)) continue;
      items.push({
        key: o.Key,
        name: o.Key.split("/").pop() ?? o.Key,
        url: await presignedGet(o.Key),
        size: o.Size ?? 0,
        lastModified: o.LastModified?.toISOString() ?? "",
      });
    }
    groups.push({ category, items });
  }
  return groups;
}

export async function listAssets(): Promise<AssetItem[]> {
  // S3 is the source of truth for which files exist + their size/date; the DynamoDB
  // metadata (tags, uploader, original size) is left-joined by key, so an asset with
  // no record still appears — just untagged.
  const meta = await listAssetMeta().catch(() => new Map());
  const out: AssetItem[] = [];
  for (const visibility of ["public", "private"] as Visibility[]) {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${visibility}/`, MaxKeys: 200 }));
    for (const o of res.Contents ?? []) {
      if (!o.Key || o.Key.endsWith("/")) continue;
      const name = o.Key.split("/").pop() ?? o.Key;
      const m = meta.get(o.Key);
      out.push({
        key: o.Key,
        name,
        kind: m?.kind ?? classifyKind(name, m?.contentType),
        size: o.Size ?? 0,
        lastModified: o.LastModified?.toISOString() ?? "",
        visibility,
        url: visibility === "public" ? publicUrl(o.Key) : await presignedGet(o.Key),
        tags: m?.tags ?? [],
        uploadedBy: m?.uploadedBy,
        originalSize: m?.originalSize,
      });
    }
  }
  return out.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
}
