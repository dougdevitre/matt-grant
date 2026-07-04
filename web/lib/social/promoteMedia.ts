import { getObjectBytes, uploadObject, publicUrl, s3Configured } from "@/lib/s3";
import { toWebSafeImage } from "@/lib/images";
import { putAssetMeta } from "@/lib/assets";
import { publicSocialKey } from "@/lib/social/assetMedia";

export { publicSocialKey };

// Promote a PRIVATE library object (a shoot photo or private asset) to a STABLE
// PUBLIC copy so it becomes valid social-post media. Private assets are served via
// short-lived presigned URLs that expire before a scheduled drain fires and that
// social networks can't fetch; a public CloudFront copy is durable. This is the one
// path that unlocks the (otherwise unpostable) Photo library from the composer.
//
// The destination key is derived deterministically from the source, so re-promoting
// the same photo overwrites the same object instead of piling up duplicates.

const IMAGE_RE = /\.(jpe?g|png|webp|gif|heic|tiff?)$/i;
const EXT_FOR: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Swap the extension to match the stored content type (a transcoded HEIC lands as .jpg).
function withExtFor(key: string, contentType: string): string {
  const ext = EXT_FOR[contentType];
  return ext ? key.replace(/\.[^.]+$/, "") + "." + ext : key;
}

export type PromotedMedia = { key: string; url: string; name: string };

export async function promoteToPublicImage(sourceKey: string, uploadedBy?: string): Promise<PromotedMedia> {
  if (!s3Configured) throw new Error("S3 not configured");
  if (!sourceKey.startsWith("private/")) throw new Error("Only private library objects can be promoted");
  if (!IMAGE_RE.test(sourceKey)) throw new Error("Only images can be used as post media");
  if (!publicUrl(sourceKey)) throw new Error("CDN not configured (set ASSETS_CDN_URL)");

  const { body, contentType } = await getObjectBytes(sourceKey);
  // Web/social-safe + optimized: multi-MB shoot originals are downscaled to fit
  // platform limits, and HEIC/TIFF phone masters are transcoded to JPEG.
  const { buffer, contentType: storedType } = await toWebSafeImage(body, contentType);

  const destKey = withExtFor(publicSocialKey(sourceKey), storedType);
  const name = destKey.split("/").pop() ?? destKey;
  await uploadObject(destKey, buffer, storedType, {
    // A week, not immutable: the source is static, but avoid a year-long stale cache
    // if a photo is ever re-shot and re-promoted under the same name.
    cacheControl: "public, max-age=604800",
    metadata: { "promoted-from": sourceKey, "uploaded-by": uploadedBy ?? "", kind: "image" },
  });
  // Record it in the asset library so the promoted copy shows up under Assets too.
  await putAssetMeta({
    key: destKey,
    name,
    contentType: storedType,
    kind: "image",
    visibility: "public",
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    tags: ["social", "photo"],
  });
  return { key: destKey, url: publicUrl(destKey), name };
}
