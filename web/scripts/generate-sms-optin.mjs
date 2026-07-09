// Generates a branded "opt in by text" graphic in the campaign navy/blue + red style.
// Tells supporters exactly how to join the SMS list — accurate to the real flow
// (text the keyword -> welcome reply; no fabricated double opt-in). Portrait + square.
//
//   node scripts/generate-sms-optin.mjs
//
// Output: public/brand/sms-optin.png (1080x1350) + public/brand/sms-optin-square.png (1080x1080).
import sharp from "sharp";
import path from "node:path";

const LOGO = path.join(process.cwd(), "public", "brand", "logo.png");
const OUT_DIR = path.join(process.cwd(), "public", "brand");

// Campaign facts — do not change (FEC committee C00945394).
const KEYWORD = "MATT";
const NUMBER = "(844) 314-7912";
const SITE = "mattgrantforcongress.org";
const DISCLAIMER = "Paid for by Matt Grant for Congress.";

const C = {
  navy0: "#061328", navy1: "#0b2244", navy2: "#13386b",
  blue: "#4aa3ff", blueSoft: "#9fc4f0", red: "#e23b3b", white: "#ffffff", muted: "#8fa6c4",
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const STEPS = [
  ["1", `Text ${KEYWORD} to ${NUMBER}`],
  ["2", "Get a welcome text + join link"],
  ["3", "You’re in — reply STOP anytime"],
];

// One numbered step row: a blue circle + label, left-aligned from x.
function stepRow(n, label, x, y) {
  return `
    <circle cx="${x + 30}" cy="${y}" r="30" fill="${C.blue}"/>
    <text x="${x + 30}" y="${y + 12}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="${C.navy0}">${n}</text>
    <text x="${x + 84}" y="${y + 12}" font-family="Helvetica, Arial, sans-serif" font-size="36" fill="${C.white}">${esc(label)}</text>`;
}

function buildSvg(W, H, logo) {
  // Vertical rhythm anchored to the canvas so portrait + square both balance.
  const cx = W / 2;
  const logoTop = Math.round(H * 0.06);
  const logoW = Math.round(logo.w), logoH = Math.round(logo.h);
  const eyebrowY = logoTop + logoH + 70;
  const labelY = eyebrowY + 78;
  const textY = labelY + 74;
  const pillY = textY + 30; // pill top
  const pillW = 300, pillH = 128, pillR = 16;
  const numY = pillY + pillH + 96;
  const stepsTop = numY + 96;
  const saveY = stepsTop + STEPS.length * 92 + 24; // "save us" callout, portrait only (room permitting)
  const footY = H - 150;

  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="30%" r="82%">
      <stop offset="0%" stop-color="${C.navy2}"/><stop offset="55%" stop-color="${C.navy1}"/><stop offset="100%" stop-color="${C.navy0}"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- white plate behind the logo so the navy/red wordmark reads on the dark bg -->
  <rect x="${cx - logoW / 2 - 34}" y="${logoTop - 26}" width="${logoW + 68}" height="${logoH + 52}" rx="18" fill="#ffffff"/>
  <!-- subtle tech accent lines -->
  <g stroke="${C.blue}" stroke-opacity="0.14" stroke-width="2" fill="none">
    <path d="M0 ${Math.round(H * 0.18)} L300 ${Math.round(H * 0.18)} L340 ${Math.round(H * 0.18) - 40} L820 ${Math.round(H * 0.18) - 40}"/>
    <path d="M${W} ${Math.round(H * 0.7)} L${W - 300} ${Math.round(H * 0.7)} L${W - 340} ${Math.round(H * 0.7) + 40} L${W - 760} ${Math.round(H * 0.7) + 40}"/>
  </g>

  <!-- eyebrow -->
  <text x="${cx}" y="${eyebrowY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="27" letter-spacing="4" font-weight="700" fill="${C.blueSoft}">MATT GRANT FOR CONGRESS · MISSOURI DISTRICT 2</text>
  <rect x="${cx - 30}" y="${eyebrowY + 20}" width="60" height="4" fill="${C.red}"/>

  <!-- hero -->
  <text x="${cx}" y="${labelY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="34" letter-spacing="2" font-weight="700" fill="${C.white}">GET CAMPAIGN UPDATES BY TEXT</text>
  <text x="${cx}" y="${textY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="700" fill="${C.blueSoft}">TEXT</text>
  <rect x="${cx - pillW / 2}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillR}" fill="${C.red}"/>
  <text x="${cx}" y="${pillY + pillH / 2 + 34}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="700" fill="${C.white}">${KEYWORD}</text>
  <text x="${cx}" y="${numY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="70" font-weight="700" fill="${C.white}">to ${esc(NUMBER)}</text>

  <!-- how it works -->
  ${STEPS.map(([n, label], i) => stepRow(n, label, Math.round(W * 0.16), stepsTop + i * 92)).join("")}

  <!-- save-our-number tip (portrait has the room; kills the "unknown sender" spam flag) -->
  ${H >= 1200 ? `<rect x="${cx - 390}" y="${saveY - 42}" width="780" height="70" rx="14" fill="${C.blue}" fill-opacity="0.14"/>
  <text x="${cx}" y="${saveY + 3}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="${C.white}">Save us as Matt Grant for Congress</text>` : ""}

  <!-- footer / compliance -->
  <line x1="80" y1="${footY}" x2="${W - 80}" y2="${footY}" stroke="${C.blue}" stroke-opacity="0.25" stroke-width="2"/>
  <text x="${cx}" y="${footY + 42}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="${C.muted}">Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help.</text>
  <text x="${cx}" y="${footY + 78}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="700" fill="${C.white}">${esc(SITE)}</text>
  <text x="${cx}" y="${footY + 110}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="${C.muted}">${esc(DISCLAIMER)}</text>
</svg>`);
}

async function render(W, H, file) {
  // Fit the logo to a fixed height, keep aspect, and composite it centered at top.
  const targetH = Math.round(H * 0.11);
  const logoBuf = await sharp(LOGO).resize({ height: targetH }).png().toBuffer();
  const meta = await sharp(logoBuf).metadata();
  const logo = { w: meta.width, h: meta.height };
  const top = Math.round(H * 0.06);
  const left = Math.round((W - logo.w) / 2);
  await sharp(buildSvg(W, H, logo))
    .composite([{ input: logoBuf, top, left }])
    .png()
    .toFile(path.join(OUT_DIR, file));
  console.log(`  ✓ ${file}  (${W}x${H})`);
}

async function main() {
  console.log("Generating SMS opt-in graphics →", OUT_DIR);
  await render(1080, 1350, "sms-optin.png");
  await render(1080, 1080, "sms-optin-square.png");
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
