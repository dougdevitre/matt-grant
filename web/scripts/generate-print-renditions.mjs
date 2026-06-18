// Renders each campaign design to the EXACT Walgreens photo-print aspect ratios
// (4x6, 5x7, 8x10 portrait @ 300 DPI) so faces and the disclaimer never get
// cropped at the lab. Output: /tmp/print-renditions/<id>/<size>.jpg, uploaded
// to s3://matt-grant-for-congress/public/print/walgreens/<id>/<size>.jpg, plus
// a data-as-code manifest at lib/printRenditions.json that the print studio reads.
//
//   node scripts/generate-print-renditions.mjs
//
// Faithful to the platform; no fabricated quotes beyond his stated positions.
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = path.join(process.cwd(), "public", "brand", "matt-grant-source.png");
const OUT = "/tmp/print-renditions";
const BUCKET = "matt-grant-for-congress";
const CDN = "https://d5jzyan9wboi3.cloudfront.net";
const DPI = 300;

// Portrait photo-print sizes (inches). Keys match Walgreens `productSize`.
const SIZES = { "4x6": [4, 6], "5x7": [5, 7], "8x10": [8, 10] };

const C = {
  navy0: "#061328", navy1: "#0b2244", navy2: "#13386b",
  blue: "#4aa3ff", blueSoft: "#9fc4f0", red: "#e23b3b", white: "#ffffff", muted: "#8fa6c4",
};

// 12 signature designs (id matches the social feed square used as the thumbnail).
const DESIGNS = [
  ["D-50", "I don't just talk — I take action.", "MATT GRANT FOR CONGRESS"],
  ["D-48", "I know what families need — I'm raising one too.", "FAMILIES FIRST"],
  ["D-47", "The one fight no one else is having: clean up the family courts.", "CHILDREN FIRST"],
  ["D-46", "No clean courts, no check. Simple accountability.", "THE CHILD PROTECTION ACT"],
  ["D-45", "Term limits — including my own seat.", "TERM LIMITS"],
  ["D-44", "Right-size Washington before you ask families for another dime.", "SMALLER GOVERNMENT"],
  ["D-43", "Cut the waste first. Then talk tax rates.", "LOWER TAXES"],
  ["D-42", "Four fights worth winning.", "THE PLATFORM"],
  ["D-40", "I'm coming to your county. Every voice counts.", "EVERY COUNTY"],
  ["D-39", "Now someone is fighting for our kids.", "CHILDREN FIRST"],
  ["D-38", "Service isn't a slogan — it's a habit.", "PROVEN SERVICE"],
  ["D-33", "The values I was raised on, carried into office.", "FAITH & COMMUNITY"],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const titleize = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
function wrap(text, max) {
  const words = text.split(" "); const lines = []; let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max) { lines.push(line.trim()); line = w; }
    else line += " " + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}
const circle = (d) => Buffer.from(`<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/></svg>`);

// Shared photo geometry (fractions of H / W) — used by the layout AND the
// composite step so the ring and the headshot always line up.
const PHOTO_CY = 0.29, PHOTO_D = 0.48;

// Proportional layout that adapts to any portrait aspect (positions as fractions).
function buildCard(quote, eyebrow, W, H) {
  const fs = quote.length > 56 ? 0.068 * W : quote.length > 32 ? 0.082 * W : 0.094 * W;
  const maxChars = Math.max(12, Math.floor((W * 0.86) / (fs * 0.52)));
  const lines = wrap(quote, maxChars);
  const lh = fs * 1.16;
  const blockH = lines.length * lh;
  const ringR = (PHOTO_D / 2) * W;
  const photoBottom = PHOTO_CY * H + ringR + 0.02 * W;

  // Center the quote ~0.63H, but never let it ride up into the portrait.
  let qTop = 0.63 * H - blockH / 2 + fs; // baseline of the first line
  const minFirstTop = photoBottom + 0.04 * H;
  if (qTop - fs < minFirstTop) qTop = minFirstTop + fs;
  const lastBaseline = qTop + (lines.length - 1) * lh;
  const divY = Math.min(lastBaseline + 0.05 * H, 0.85 * H); // divider sits BELOW the text

  const tspans = lines.map((l, i) => `<tspan x="${W / 2}" dy="${i === 0 ? 0 : lh}">${esc(l)}</tspan>`).join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="28%" r="82%">
      <stop offset="0%" stop-color="${C.navy2}"/><stop offset="55%" stop-color="${C.navy1}"/><stop offset="100%" stop-color="${C.navy0}"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${C.blue}"/><stop offset="100%" stop-color="${C.red}"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${W}" height="${0.012 * H}" fill="${C.red}"/>
  <rect x="${0.06 * W}" y="${0.072 * H}" width="${0.05 * W}" height="${0.004 * H}" fill="${C.red}"/>
  <text x="${0.06 * W + 0.07 * W}" y="${0.083 * H}" font-family="Helvetica, Arial, sans-serif" font-size="${0.032 * W}" letter-spacing="${0.006 * W}" font-weight="700" fill="${C.blueSoft}">${esc(eyebrow)}</text>
  <circle cx="${W / 2}" cy="${PHOTO_CY * H}" r="${ringR + 0.014 * W}" fill="none" stroke="url(#ring)" stroke-width="${0.012 * W}"/>
  <text x="${W / 2}" y="${Math.round(qTop)}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${fs}" fill="${C.white}">${tspans}</text>
  <rect x="${W / 2 - 0.07 * W}" y="${Math.round(divY)}" width="${0.14 * W}" height="${0.006 * H}" fill="${C.red}"/>
  <text x="${W / 2}" y="${0.90 * H}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${0.034 * W}" font-weight="700" fill="${C.white}">MATT GRANT FOR CONGRESS · MO-02</text>
  <text x="${W / 2}" y="${0.935 * H}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${0.042 * W}" font-weight="800" fill="${C.red}">AUGUST 4, 2026</text>
  <text x="${W / 2}" y="${0.965 * H}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${0.019 * W}" fill="${C.muted}">mattgrantforcongress.org · Paid for by the Matt Grant for Congress Committee.</text>
</svg>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const designs = [];
  for (const [id, quote, eyebrow] of DESIGNS) {
    await mkdir(path.join(OUT, id), { recursive: true });
    const sizes = {};
    for (const [size, [wIn, hIn]] of Object.entries(SIZES)) {
      const W = wIn * DPI, H = hIn * DPI;
      const D = Math.round(PHOTO_D * W);
      const photo = await sharp(SRC).resize(D, D, { fit: "cover", position: "north" })
        .composite([{ input: circle(D), blend: "dest-in" }]).png().toBuffer();
      const svg = buildCard(quote, eyebrow, W, H).replace(/^(<svg )width="\d+" height="\d+"/, `$1width="${W}" height="${H}"`);
      await sharp(Buffer.from(svg))
        .composite([{ input: photo, top: Math.round(PHOTO_CY * H - D / 2), left: Math.round(W / 2 - D / 2) }])
        .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
        .toFile(path.join(OUT, id, `${size}.jpg`));
      sizes[size] = `${CDN}/public/print/walgreens/${id}/${size}.jpg`;
    }
    designs.push({ id, label: titleize(eyebrow), thumb: `${CDN}/public/social/feed/${id}.png`, sizes });
  }

  // upload
  execFileSync("aws", ["s3", "cp", OUT + "/", `s3://${BUCKET}/public/print/walgreens/`, "--recursive",
    "--exclude", "*", "--include", "*.jpg", "--content-type", "image/jpeg",
    "--cache-control", "public, max-age=604800, immutable", "--only-show-errors"],
    { stdio: "inherit", env: { ...process.env, AWS_DEFAULT_REGION: "us-east-1", AWS_PAGER: "" } });

  const manifest = { cdn: CDN, sizes: Object.keys(SIZES), designs };
  await writeFile(path.join(process.cwd(), "lib", "printRenditions.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`✓ ${designs.length} designs × ${Object.keys(SIZES).length} sizes → S3 + lib/printRenditions.json`);
}
main();
