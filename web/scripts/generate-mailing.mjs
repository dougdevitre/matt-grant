// Turnkey mailing for the Tier-1 family-court letters: writes a mail-merge CSV
// (candidate/letters/tier1-mailing.csv) and renders a print-ready Avery 5160
// label sheet (3x10) uploaded to public/print/tier1-mailing-labels.pdf.
// Roster is the mo-gov seed — VERIFY rooms/addresses against senate.mo.gov.
//
//   node scripts/generate-mailing.mjs
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BUCKET = "matt-grant-for-congress";
const ROSTER = [
  { first: "Nick", last: "Schroer", district: 2, room: "227" },
  { first: "David", last: "Gregory", district: 15, room: "331" },
  { first: "Karla", last: "May", district: 4, room: "225" },
  { first: "Steven", last: "Roberts", district: 5, room: "434" },
  { first: "Mary Elizabeth", last: "Coleman", district: 22, room: "331A" },
  { first: "Adam", last: "Schnelting", district: 23, room: "219" },
  { first: "Ben", last: "Brown", district: 26, room: "430" },
  { first: "Jamie", last: "Burger", district: 27, room: "334" },
  { first: "Jill", last: "Carter", district: 32, room: "" },
  { first: "Brad", last: "Hudson", district: 33, room: "" },
  { first: "Maggie", last: "Nurrenbern", district: 17, room: "" },
  { first: "Rick", last: "Brattin", district: 31, room: "" },
];

const street = (room) => `201 W. Capitol Ave.${room ? `, Rm. ${room}` : ""}`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---- CSV (Word/Avery mail merge) ----
function csv() {
  const cols = ["FullName", "Address1", "Address2", "City", "State", "Zip", "Salutation", "District"];
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = ROSTER.map((s) =>
    [`The Honorable ${s.first} ${s.last}`, "Missouri Senate", street(s.room), "Jefferson City", "MO", "65101", `Senator ${s.last}`, s.district].map(q).join(","));
  return [cols.join(","), ...rows].join("\n") + "\n";
}

// ---- Avery 5160 sheet (US Letter, 3 cols x 10 rows, 2.625" x 1") ----
const DPI = 200, W = 8.5 * DPI, H = 11 * DPI;
function labelSheet() {
  const lw = 2.625 * DPI, lh = 1 * DPI;
  const colX = [0.1875, 0.1875 + 2.75, 0.1875 + 2 * 2.75].map((x) => x * DPI);
  const top = 0.5 * DPI, rowPitch = 1 * DPI;
  const cells = [];
  ROSTER.forEach((s, i) => {
    const x = colX[i % 3] + 34, y = top + Math.floor(i / 3) * rowPitch + 56;
    const lines = [`The Honorable ${s.first} ${s.last}`, "Missouri Senate", street(s.room), "Jefferson City, MO 65101"];
    cells.push(lines.map((l, j) =>
      `<text x="${x}" y="${y + j * 34}" font-family="Helvetica, Arial, sans-serif" font-size="${j === 0 ? 25 : 23}" font-weight="${j === 0 ? 700 : 400}" fill="#0b1c34">${esc(l)}</text>`).join(""));
  });
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${cells.join("\n  ")}
</svg>`;
}

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
  await writeFile(path.join(process.cwd(), "..", "candidate", "letters", "tier1-mailing.csv"), csv());
  const tmp = "/tmp/mailing";
  await mkdir(tmp, { recursive: true });
  const png = await sharp(Buffer.from(labelSheet())).png().toBuffer();
  await writeFile(path.join(tmp, "labels.png"), png);
  const jpeg = await sharp(png).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer();
  await writeFile(path.join(tmp, "labels.pdf"), jpegToPdf(jpeg, 8.5, 11, W, H));
  execFileSync("aws", ["s3", "cp", path.join(tmp, "labels.pdf"), `s3://${BUCKET}/public/print/tier1-mailing-labels.pdf`, "--content-type", "application/pdf", "--cache-control", "public, max-age=604800", "--only-show-errors"],
    { stdio: "inherit", env: { ...process.env, AWS_DEFAULT_REGION: "us-east-1", AWS_PAGER: "" } });
  console.log(`✓ ${ROSTER.length} → candidate/letters/tier1-mailing.csv + public/print/tier1-mailing-labels.pdf (Avery 5160)`);
}
main();
