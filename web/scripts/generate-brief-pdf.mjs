// Renders the CHILD Protection Act one-pager as a branded, print-ready 8.5x11
// PDF leave-behind (navy header + body sections + disclaimer), uploads it to
// public/marketing/child-protection-act-brief.{pdf,png}. Content is faithful to
// candidate/platform.md — no invented stats or claims.
//
//   node scripts/generate-brief-pdf.mjs
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = "/tmp/brief";
const BUCKET = "matt-grant-for-congress";
const DPI = 200;
const W = 8.5 * DPI, H = 11 * DPI; // 1700 x 2200

const C = {
  navy0: "#061328", navy1: "#0b2244", navy2: "#13386b",
  blue: "#4aa3ff", blueSoft: "#9fc4f0", red: "#e23b3b",
  white: "#ffffff", ink: "#0b1c34", slate: "#41526b", muted: "#8fa6c4",
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

const SECTIONS = [
  ["The problem", "Too many children are caught in a family-court system that can protect insiders instead of kids. When dockets stay closed and courts aren't held accountable, families pay the price — and children lose. Eliminating corruption in the family courts is the cause at the center of Matt Grant's candidacy."],
  ["The solution — the CHILD Protection Act of 2027", "Corruption Hiding Inside Legal Dockets. The proposal calls for federal oversight that ties Title IV-D federal grant money to state family-court compliance — using the federal grant program as the lever for accountability in state family courts. Clean, accountable courts keep the federal check; corrupt ones don't."],
  ["Why Matt", "A neighbor, a dad, and a problem-solver with 25 years in the courtroom. He has already taken this fight to federal court — a matter of public record. Matt doesn't just talk; he takes action, and he's running for Congress to put Missouri's children first."],
  ["The ask", "Endorse the reform, stand as an issue ally, or help amplify it to Missouri families."],
];

function buildSvg() {
  const M = 140; // margin
  const bandH = 0.16 * H;
  let y = bandH + 120; // body cursor
  const blocks = [];
  for (const [heading, body] of SECTIONS) {
    blocks.push(`<text x="${M}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="36" font-weight="800" fill="${C.ink}">${esc(heading)}</text>`);
    y += 54;
    for (const line of wrap(body, 96)) {
      blocks.push(`<text x="${M}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="27" fill="${C.slate}">${esc(line)}</text>`);
      y += 38;
    }
    y += 44; // gap between sections
  }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="band" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${C.navy2}"/><stop offset="60%" stop-color="${C.navy1}"/><stop offset="100%" stop-color="${C.navy0}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="${C.white}"/>
  <rect x="0" y="0" width="${W}" height="${bandH}" fill="url(#band)"/>
  <rect x="0" y="${bandH}" width="${W}" height="10" fill="${C.red}"/>
  <text x="${M}" y="110" font-family="Helvetica, Arial, sans-serif" font-size="26" letter-spacing="6" font-weight="700" fill="${C.blueSoft}">MATT GRANT FOR CONGRESS · MISSOURI DISTRICT 2</text>
  <text x="${M}" y="200" font-family="Helvetica, Arial, sans-serif" font-size="62" font-weight="800" fill="${C.white}">The CHILD Protection Act of 2027</text>
  <text x="${M}" y="262" font-family="Helvetica, Arial, sans-serif" font-size="32" font-weight="600" fill="${C.blueSoft}">Corruption Hiding Inside Legal Dockets</text>
  ${blocks.join("\n  ")}
  <line x1="${M}" y1="${H - 230}" x2="${W - M}" y2="${H - 230}" stroke="${C.muted}" stroke-opacity="0.5" stroke-width="3"/>
  <text x="${M}" y="${H - 175}" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="${C.ink}">mattgrantforcongress@gmail.com · (314) 255-7760 · mattgrantforcongress.org</text>
  <text x="${M}" y="${H - 120}" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="800" fill="${C.red}">PRIMARY · AUGUST 4, 2026</text>
  <text x="${M}" y="${H - 78}" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="${C.slate}">Paid for by Matt Grant for Congress.</text>
</svg>`;
}

// single-image PDF (DCTDecode/JPEG) — same approach as the print kit
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
  push(jpeg); push("\nendstream\nendobj\n");
  const xrefPos = pos;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  push(xref);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);
  return Buffer.concat(parts);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const png = await sharp(Buffer.from(buildSvg())).png().toBuffer();
  await writeFile(path.join(OUT, "child-protection-act-brief.png"), png);
  const jpeg = await sharp(png).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer();
  await writeFile(path.join(OUT, "child-protection-act-brief.pdf"), jpegToPdf(jpeg, 8.5, 11, W, H));
  const env = { ...process.env, AWS_DEFAULT_REGION: "us-east-1", AWS_PAGER: "" };
  execFileSync("aws", ["s3", "cp", path.join(OUT, "child-protection-act-brief.pdf"), `s3://${BUCKET}/public/marketing/child-protection-act-brief.pdf`, "--content-type", "application/pdf", "--cache-control", "public, max-age=604800", "--only-show-errors"], { stdio: "inherit", env });
  execFileSync("aws", ["s3", "cp", path.join(OUT, "child-protection-act-brief.png"), `s3://${BUCKET}/public/marketing/child-protection-act-brief.png`, "--content-type", "image/png", "--cache-control", "public, max-age=604800", "--only-show-errors"], { stdio: "inherit", env });
  console.log("✓ brief PDF + PNG → public/marketing/child-protection-act-brief.{pdf,png}");
}
main();
