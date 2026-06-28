// Generates the campaign print kit — yard sign, palm card (2 sides), and a
// mailer (2 sides) — in the dark navy/blue + red brand style. Each piece is
// rendered as a proof PNG and a print-ready PDF (a single full-bleed image
// embedded via DCTDecode, so no extra PDF dependency).
//
//   node scripts/generate-print-kit.mjs
//
// Output: /tmp/print-kit/*.{png,pdf}. Faithful to the platform; no invented
// facts, quotes, party labels, or endorsements.
//
// NOTE: PDFs are RGB at the listed DPI with a 0.125" bleed. Online printers
// (VistaPrint, UPrinting, PFL) accept RGB and convert to CMYK. For an offset
// shop that requires CMYK, hand these to a designer for a color convert first.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = path.join(process.cwd(), "public", "brand", "matt-grant-source.png");
const OUT = "/tmp/print-kit";

const C = {
  navy0: "#061328", navy1: "#0b2244", navy2: "#13386b",
  blue: "#4aa3ff", blueSoft: "#9fc4f0", red: "#e23b3b",
  white: "#ffffff", paper: "#f7f5ef", ink: "#0b1c34", muted: "#8fa6c4", slate: "#5b6b82",
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

const FOUR = [
  ["01", "Clean up the family courts", "Champion the CHILD Protection Act and tie federal grant money to states that keep their family courts honest."],
  ["02", "Term limits — including my own", "End careerism in both chambers, with a grandfather clause so reform actually passes."],
  ["03", "A smaller, leaner government", "A federal hiring freeze and voluntary early retirement to right-size Washington."],
  ["04", "Lower taxes by cutting waste", "Go after fraud and bloat first, so relief is funded by efficiency — not gimmicks."],
];

// ---- single-image PDF (DCTDecode/JPEG) ----
function jpegToPdf(jpeg, wIn, hIn, pxW, pxH) {
  const wPt = +(wIn * 72).toFixed(2), hPt = +(hIn * 72).toFixed(2);
  const parts = []; const offsets = []; let pos = 0;
  const push = (b) => { const buf = Buffer.isBuffer(b) ? b : Buffer.from(b, "binary"); parts.push(buf); pos += buf.length; };
  const obj = (n, body) => { offsets[n] = pos; push(`${n} 0 obj\n`); push(body); push("\nendobj\n"); };
  push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  const content = `q ${wPt} 0 0 ${hPt} 0 0 cm /Im0 Do Q`;
  obj(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  offsets[5] = pos;
  push(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push("\nendstream\nendobj\n");
  const xrefPos = pos;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  push(xref);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);
  return Buffer.concat(parts);
}

async function emit(name, svg, wIn, hIn, dpi, composites = []) {
  const pxW = Math.round(wIn * dpi), pxH = Math.round(hIn * dpi);
  // Render the viewBox coordinate space down to the target pixel size so
  // librsvg doesn't try to rasterize at the (huge) intrinsic dimensions.
  const sized = svg.replace(/^(<svg )width="\d+" height="\d+"/, `$1width="${pxW}" height="${pxH}"`);
  const png = await sharp(Buffer.from(sized)).resize(pxW, pxH).composite(composites).png().toBuffer();
  await writeFile(path.join(OUT, `${name}.png`), png);
  const jpeg = await sharp(png).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer();
  await writeFile(path.join(OUT, `${name}.pdf`), jpegToPdf(jpeg, wIn, hIn, pxW, pxH));
  console.log(`  ✓ ${name}  (${wIn}×${hIn}in @ ${dpi}dpi)`);
}

// Reusable bits (coordinates are in the SVG's own viewBox units = inches*1000)
const paidFor = "Paid for by Matt Grant for Congress.";

// ---------- YARD SIGN 24×18 (+0.125 bleed → 24.25×18.25) ----------
function yardSign() {
  const W = 24250, H = 18250; // thousandths of an inch
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="bg" cx="50%" cy="38%" r="75%">
    <stop offset="0%" stop-color="${C.navy2}"/><stop offset="55%" stop-color="${C.navy1}"/><stop offset="100%" stop-color="${C.navy0}"/>
  </radialGradient><linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${C.blue}"/><stop offset="100%" stop-color="${C.red}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${W}" height="520" fill="${C.red}"/>
  <rect x="0" y="${H - 520}" width="${W}" height="520" fill="url(#rule)"/>
  <g font-family="Helvetica, Arial, sans-serif" text-anchor="middle" fill="${C.white}">
    <text x="${W / 2}" y="6650" font-size="3100" font-weight="800" letter-spacing="20">MATT GRANT</text>
    <text x="${W / 2}" y="9050" font-size="1600" font-weight="700" letter-spacing="300" fill="${C.blueSoft}">FOR CONGRESS</text>
    <rect x="${W / 2 - 2600}" y="9700" width="5200" height="60" fill="${C.red}"/>
    <text x="${W / 2}" y="11650" font-size="1280" font-weight="700" letter-spacing="120">MISSOURI · DISTRICT 2</text>
    <text x="${W / 2}" y="14250" font-size="1450" font-weight="800" fill="${C.red}">PRIMARY · AUGUST 4, 2026</text>
    <text x="${W / 2}" y="15750" font-size="980" font-weight="600" fill="${C.muted}">mattgrantforcongress.org</text>
  </g>
  <text x="${W / 2}" y="${H - 170}" font-family="Helvetica, Arial, sans-serif" text-anchor="middle" font-size="430" fill="#ffffff" fill-opacity="0.9">${paidFor}</text>
</svg>`;
}

// ---------- PALM CARD 4×6 (+bleed → 4.25×6.25) ----------
function palmFront() {
  const W = 4250, H = 6250;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="bg" cx="50%" cy="30%" r="80%">
    <stop offset="0%" stop-color="${C.navy2}"/><stop offset="55%" stop-color="${C.navy1}"/><stop offset="100%" stop-color="${C.navy0}"/></radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${C.blue}"/><stop offset="100%" stop-color="${C.red}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${W}" height="120" fill="${C.red}"/>
  <circle cx="${W / 2}" cy="2080" r="1180" fill="none" stroke="url(#ring)" stroke-width="36"/>
  <g font-family="Helvetica, Arial, sans-serif" text-anchor="middle" fill="${C.white}">
    <text x="${W / 2}" y="3850" font-size="520" font-weight="800" letter-spacing="6">MATT GRANT</text>
    <text x="${W / 2}" y="4320" font-size="200" font-weight="700" letter-spacing="30" fill="${C.blueSoft}">FOR CONGRESS · MO-02</text>
    <rect x="${W / 2 - 480}" y="4560" width="960" height="22" fill="${C.red}"/>
    <text x="${W / 2}" y="5180" font-size="270" font-weight="600" fill="${C.white}">A neighbor, a dad,</text>
    <text x="${W / 2}" y="5500" font-size="270" font-weight="600" fill="${C.white}">and a problem-solver.</text>
    <text x="${W / 2}" y="5980" font-size="300" font-weight="800" fill="${C.red}">VOTE · AUGUST 4, 2026</text>
  </g>
</svg>`;
}
function palmBack() {
  const W = 4250, H = 6250;
  const rows = FOUR.map(([n, t], i) => {
    const y = 1500 + i * 980;
    const tl = wrap(t, 19);
    const title = tl.map((l, j) => `<tspan x="820" dy="${j === 0 ? 0 : 270}">${esc(l)}</tspan>`).join("");
    return `<text x="340" y="${y}" font-size="400" font-weight="800" fill="${C.red}">${n}</text>
      <text x="820" y="${y - 130}" font-size="250" font-weight="800" fill="${C.ink}">${title}</text>`;
  }).join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${C.paper}"/>
  <rect x="0" y="0" width="${W}" height="120" fill="${C.red}"/>
  <text x="${W / 2}" y="780" font-family="Helvetica, Arial, sans-serif" text-anchor="middle" font-size="360" font-weight="800" letter-spacing="40" fill="${C.ink}">THE FOUR FIGHTS</text>
  <rect x="${W / 2 - 360}" y="950" width="720" height="20" fill="${C.blue}"/>
  <g font-family="Helvetica, Arial, sans-serif">${rows}</g>
  <rect x="300" y="5180" width="${W - 600}" height="640" rx="40" fill="${C.navy1}"/>
  <text x="${W / 2}" y="5470" font-family="Helvetica, Arial, sans-serif" text-anchor="middle" font-size="255" font-weight="800" fill="${C.white}">VOTE MATT GRANT · AUG 4</text>
  <text x="${W / 2}" y="5720" font-family="Helvetica, Arial, sans-serif" text-anchor="middle" font-size="230" fill="${C.blueSoft}">mattgrantforcongress.org</text>
  <text x="${W / 2}" y="6080" font-family="Helvetica, Arial, sans-serif" text-anchor="middle" font-size="170" fill="${C.slate}">${paidFor}</text>
</svg>`;
}

// ---------- MAILER 6×9 postcard (+bleed → 6.25×9.25) ----------
function mailerFront() {
  const W = 6250, H = 9250;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="bg" cx="50%" cy="32%" r="80%">
    <stop offset="0%" stop-color="${C.navy2}"/><stop offset="55%" stop-color="${C.navy1}"/><stop offset="100%" stop-color="${C.navy0}"/></radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${C.blue}"/><stop offset="100%" stop-color="${C.red}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${W}" height="150" fill="${C.red}"/>
  <text x="${W / 2}" y="1180" font-family="Helvetica, Arial, sans-serif" text-anchor="middle" font-size="240" font-weight="700" letter-spacing="40" fill="${C.blueSoft}">A NEW STANDARD OF SERVICE</text>
  <circle cx="${W / 2}" cy="3550" r="1380" fill="none" stroke="url(#ring)" stroke-width="40"/>
  <g font-family="Helvetica, Arial, sans-serif" text-anchor="middle" fill="${C.white}">
    <text x="${W / 2}" y="5650" font-size="720" font-weight="800" letter-spacing="8">MATT GRANT</text>
    <text x="${W / 2}" y="6180" font-size="230" font-weight="700" letter-spacing="25" fill="${C.blueSoft}">FOR CONGRESS · MISSOURI DISTRICT 2</text>
    <rect x="${W / 2 - 700}" y="6500" width="1400" height="26" fill="${C.red}"/>
    <text x="${W / 2}" y="7350" font-size="360" font-weight="600">Show up. Do the work.</text>
    <text x="${W / 2}" y="7800" font-size="360" font-weight="600">Leave it better than you found it.</text>
    <text x="${W / 2}" y="8550" font-size="430" font-weight="800" fill="${C.red}">VOTE · AUGUST 4, 2026</text>
  </g>
</svg>`;
}
function mailerBack() {
  const W = 6250, H = 9250;
  const rows = FOUR.map(([n, t, d], i) => {
    const y = 1350 + i * 1080;
    const dl = wrap(d, 42);
    const desc = dl.map((l, j) => `<tspan x="1180" dy="${j === 0 ? 0 : 260}">${esc(l)}</tspan>`).join("");
    return `<text x="430" y="${y + 40}" font-size="560" font-weight="800" fill="${C.red}">${n}</text>
      <text x="1180" y="${y}" font-size="300" font-weight="800" fill="${C.ink}">${esc(t)}</text>
      <text x="1180" y="${y + 330}" font-size="205" fill="${C.slate}">${desc}</text>`;
  }).join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${C.paper}"/>
  <rect x="0" y="0" width="${W}" height="150" fill="${C.red}"/>
  <text x="430" y="900" font-family="Helvetica, Arial, sans-serif" font-size="340" font-weight="800" fill="${C.ink}">The four fights worth winning.</text>
  <rect x="430" y="1010" width="900" height="22" fill="${C.blue}"/>
  <g font-family="Helvetica, Arial, sans-serif">${rows}</g>
  <!-- USPS mailing panel: lower third kept clear for address + indicia -->
  <line x1="430" y1="5950" x2="${W - 430}" y2="5950" stroke="${C.muted}" stroke-opacity="0.5" stroke-width="6"/>
  <rect x="430" y="6250" width="3050" height="900" rx="30" fill="#ffffff" stroke="${C.muted}" stroke-opacity="0.5" stroke-width="6"/>
  <text x="560" y="6520" font-family="Helvetica, Arial, sans-serif" font-size="210" font-weight="800" fill="${C.ink}">VOTE MATT GRANT · AUG 4, 2026</text>
  <text x="560" y="6780" font-family="Helvetica, Arial, sans-serif" font-size="190" fill="${C.slate}">mattgrantforcongress.org</text>
  <text x="560" y="7020" font-family="Helvetica, Arial, sans-serif" font-size="160" fill="${C.slate}">${paidFor}</text>
  <rect x="${W - 1280}" y="6250" width="850" height="640" rx="20" fill="none" stroke="${C.muted}" stroke-opacity="0.6" stroke-width="6" stroke-dasharray="40 30"/>
  <text x="${W - 855}" y="6610" font-family="Helvetica, Arial, sans-serif" text-anchor="middle" font-size="150" fill="${C.muted}">INDICIA /</text>
  <text x="${W - 855}" y="6790" font-family="Helvetica, Arial, sans-serif" text-anchor="middle" font-size="150" fill="${C.muted}">POSTAGE</text>
  <text x="430" y="${H - 360}" font-family="Helvetica, Arial, sans-serif" font-size="175" fill="${C.muted}">Address panel — leave clear for the mail house / USPS EDDM.</text>
</svg>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  // circular headshots at print resolution
  const photoPalm = await sharp(SRC).resize(2200, 2200, { fit: "cover", position: "north" }).composite([{ input: circle(2200), blend: "dest-in" }]).png().toBuffer();
  const photoMail = await sharp(SRC).resize(2600, 2600, { fit: "cover", position: "north" }).composite([{ input: circle(2600), blend: "dest-in" }]).png().toBuffer();

  // palm front: card is 4.25×6.25in @ 300dpi = 1275×1875; photo center at viewBox(2080/6250)
  const palmDpi = 300, palmW = 4.25, palmH = 6.25;
  const palmPhotoPx = Math.round((2200 / 6250) * palmH * palmDpi);
  const palmCx = Math.round((4250 / 2 / 4250) * palmW * palmDpi), palmCy = Math.round((2080 / 6250) * palmH * palmDpi);
  await emit("mg-print-palmcard-front-4x6", palmFront(), palmW, palmH, palmDpi,
    [{ input: await sharp(photoPalm).resize(palmPhotoPx, palmPhotoPx).png().toBuffer(), top: palmCy - palmPhotoPx / 2 | 0, left: palmCx - palmPhotoPx / 2 | 0 }]);
  await emit("mg-print-palmcard-back-4x6", palmBack(), palmW, palmH, palmDpi);

  const mDpi = 300, mW = 6.25, mH = 9.25;
  const mPhotoPx = Math.round((2600 / 9250) * mH * mDpi);
  const mCx = Math.round((6250 / 2 / 6250) * mW * mDpi), mCy = Math.round((3550 / 9250) * mH * mDpi);
  await emit("mg-print-mailer-front-6x9", mailerFront(), mW, mH, mDpi,
    [{ input: await sharp(photoMail).resize(mPhotoPx, mPhotoPx).png().toBuffer(), top: mCy - mPhotoPx / 2 | 0, left: mCx - mPhotoPx / 2 | 0 }]);
  await emit("mg-print-mailer-back-6x9", mailerBack(), mW, mH, mDpi);

  await emit("mg-print-yardsign-24x18", yardSign(), 24.25, 18.25, 150);
  console.log(`\nPrint kit written to ${OUT}`);
}
main();
