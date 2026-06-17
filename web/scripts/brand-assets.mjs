// Generates every sized image asset from one source headshot.
//
//   1. Save Matt's photo to  web/public/brand/matt-grant-source.png  (or .jpg)
//   2. Run:  npm run brand
//
// Outputs favicons, apple-touch icon, OG share card (with photo + slogan),
// portraits, and a circular avatar. If no source exists yet, a branded "MG"
// placeholder is created so the pipeline (and the app) still works.

import sharp from "sharp";
import { mkdir, access, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const BRAND = path.join(ROOT, "public", "brand");
const APP = path.join(ROOT, "app");

const C = { ink: "#0F2540", gold: "#E0A53B", field: "#16365C", paper: "#FBFAF6", muted: "#9fb0c2" };

const exists = async (p) => access(p).then(() => true).catch(() => false);

async function findSource() {
  await mkdir(BRAND, { recursive: true });
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const p = path.join(BRAND, `matt-grant-source.${ext}`);
    if (await exists(p)) return { src: p, placeholder: false };
  }
  // No source yet — write a branded placeholder so everything still renders.
  const src = path.join(BRAND, "matt-grant-source.png");
  const svg = `<svg width="1000" height="1250" xmlns="http://www.w3.org/2000/svg">
    <rect width="1000" height="1250" fill="${C.ink}"/>
    <rect width="1000" height="14" fill="${C.gold}"/>
    <text x="500" y="700" font-family="Georgia, serif" font-size="420" font-weight="700"
          fill="${C.gold}" text-anchor="middle">MG</text>
    <text x="500" y="900" font-family="Georgia, serif" font-size="56"
          fill="${C.paper}" text-anchor="middle" opacity="0.7">PLACEHOLDER</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(src);
  return { src, placeholder: true };
}

const circle = (size) =>
  Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);

// Square crop anchored near the top so the face is kept.
const squareCover = (src, size) =>
  sharp(src).resize(size, size, { fit: "cover", position: "north" }).png().toBuffer();

async function buildOgCard(src) {
  const W = 1200, H = 630, D = 470, cx = W - 70 - D / 2, cy = H / 2;
  const photo = await sharp(await squareCover(src, D))
    .composite([{ input: circle(D), blend: "dest-in" }])
    .png()
    .toBuffer();

  const bg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="${C.ink}"/>
    <rect width="${W}" height="10" fill="${C.gold}"/>
    <circle cx="${cx}" cy="${cy}" r="${D / 2 + 8}" fill="none" stroke="${C.gold}" stroke-width="6"/>
    <text x="80" y="150" font-family="Georgia,serif" font-size="30" letter-spacing="6" fill="${C.gold}">MISSOURI · DISTRICT 2</text>
    <text x="80" y="285" font-family="Georgia,serif" font-size="82" font-weight="700" fill="${C.paper}">Put Missouri&apos;s</text>
    <text x="80" y="375" font-family="Georgia,serif" font-size="82" font-weight="700" fill="${C.gold}">children first.</text>
    <text x="80" y="475" font-family="Georgia,serif" font-size="34" fill="#cdd5df">Matt Grant for Congress</text>
    <text x="80" y="545" font-family="Georgia,serif" font-size="25" fill="${C.muted}">Election Day · August 4, 2026</text>
  </svg>`;

  await sharp(Buffer.from(bg))
    .composite([{ input: photo, top: Math.round(cy - D / 2), left: Math.round(cx - D / 2) }])
    .png()
    .toFile(path.join(BRAND, "og-card.png"));
}

async function main() {
  const { src, placeholder } = await findSource();
  await mkdir(BRAND, { recursive: true });

  // Favicons + PWA icons (top-anchored square).
  for (const s of [16, 32, 48, 192, 512]) {
    await sharp(await squareCover(src, s)).toFile(path.join(BRAND, `icon-${s}.png`));
  }
  // Next App Router auto-detects these in app/.
  await sharp(await squareCover(src, 256)).toFile(path.join(APP, "icon.png"));
  await sharp(await squareCover(src, 180)).toFile(path.join(APP, "apple-icon.png"));

  // Portraits (4:5) for the site.
  for (const w of [400, 800, 1200]) {
    await sharp(src).resize(w, Math.round(w * 1.25), { fit: "cover", position: "north" }).png().toFile(path.join(BRAND, `portrait-${w}.png`));
  }

  // Circular avatar (social profile pictures).
  const A = 800;
  await sharp(await squareCover(src, A)).composite([{ input: circle(A), blend: "dest-in" }]).png().toFile(path.join(BRAND, "avatar-circle.png"));

  // Print-resolution headshot for mailers — 6×7.5in @ 300 DPI, RGB JPEG.
  // (Send to the printer; they handle any CMYK conversion.)
  await sharp(src)
    .resize(1800, 2250, { fit: "cover", position: "north" })
    .withMetadata({ density: 300 })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(path.join(BRAND, "headshot-print-300dpi.jpg"));

  await buildOgCard(src);

  const files = (await readdir(BRAND)).filter((f) => f !== "matt-grant-source.png" && /\.(png|jpe?g|webp)$/.test(f));
  console.log(`\n✓ Brand assets generated from ${placeholder ? "PLACEHOLDER (drop the real photo at public/brand/matt-grant-source.png and rerun)" : path.basename(src)}`);
  console.log(`  ${files.length} files in public/brand + app/icon.png + app/apple-icon.png`);
  if (placeholder) console.log("  ⚠  Using placeholder — replace and run `npm run brand` again.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
