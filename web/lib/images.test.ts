import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { optimizeImage } from "@/lib/images";

describe("optimizeImage", () => {
  it("passes non-raster input (pdf/other) through untouched", async () => {
    const buf = Buffer.from("%PDF-1.4 not really a pdf");
    const r = await optimizeImage(buf, "application/pdf");
    expect(r.buffer).toBe(buf);
    expect(r.contentType).toBe("application/pdf");
  });

  it("downscales an oversized image past the long-edge cap and keeps the format", async () => {
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: { r: 10, g: 120, b: 200 } } })
      .jpeg({ quality: 100 })
      .toBuffer();
    const r = await optimizeImage(big, "image/jpeg");
    expect(r.contentType).toBe("image/jpeg"); // keep-format
    const meta = await sharp(r.buffer).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(2560);
    expect(r.buffer.length).toBeLessThanOrEqual(big.length);
  });

  it("never inflates — returns a buffer no larger than the input", async () => {
    const tiny = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
    const r = await optimizeImage(tiny, "image/png");
    expect(r.contentType).toBe("image/png");
    expect(r.buffer.length).toBeLessThanOrEqual(tiny.length);
  });
});
