import sharp from "sharp";

// Keep-format image optimization for the asset library. Re-encodes raster images
// (PNG/JPEG/WebP) in their OWN format so the stored extension and copied URLs never
// change — strips metadata, applies EXIF orientation, downscales only very large
// images, and re-encodes at a web-friendly quality. Animated GIFs, PDFs, and any
// non-raster input are passed through untouched (sharp can't usefully shrink them).
//
// Guarantees: never inflates (returns the original if the re-encode isn't smaller)
// and never throws — on any sharp error it falls back to the original buffer, so a
// bad/odd image can degrade optimization but can never fail the upload.

const RASTER = new Set(["image/png", "image/jpeg", "image/webp"]);
const DEFAULT_MAX_EDGE = 2560; // long-edge cap; plenty for web/social, trims phone-camera masters

export type OptimizeResult = { buffer: Buffer; contentType: string };

export async function optimizeImage(
  input: Buffer,
  contentType: string,
  opts: { maxEdge?: number } = {},
): Promise<OptimizeResult> {
  if (!RASTER.has(contentType)) return { buffer: input, contentType }; // gif/pdf/other → untouched
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;
  try {
    // limitInputPixels caps decode work so a small, highly-compressible file can't
    // claim ~1GB of memory on decode (a decompression bomb); above it sharp throws
    // and the catch below stores the original untouched.
    const img = sharp(input, { failOn: "none", limitInputPixels: 100_000_000 }).rotate(); // bake + strip EXIF orientation
    const meta = await img.metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (longest > maxEdge) {
      img.resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true });
    }
    if (contentType === "image/jpeg") img.jpeg({ quality: 82, mozjpeg: true });
    else if (contentType === "image/png") img.png({ compressionLevel: 9, palette: true });
    else img.webp({ quality: 82 });

    const out = await img.toBuffer();
    // Never inflate: only take the optimized buffer when it actually saved bytes.
    return out.length < input.length ? { buffer: out, contentType } : { buffer: input, contentType };
  } catch {
    return { buffer: input, contentType }; // optimization is best-effort; never block the upload
  }
}
