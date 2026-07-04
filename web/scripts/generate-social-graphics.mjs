// Generates branded 1080x1080 social graphics for the content library, in the
// dark navy/blue + red "campaign tech" style. Each = Matt's headshot + a
// quotable line. Output: /tmp/social-graphics/<id>.png (upload to S3 graphics/).
//
//   node scripts/generate-social-graphics.mjs
//
// Faithful to the platform; no fabricated quotes beyond his stated positions.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = path.join(process.cwd(), "public", "brand", "matt-grant-source.png");
const OUT = "/tmp/social-graphics";
const W = 1080, H = 1080;

const C = {
  navy0: "#061328", navy1: "#0b2244", navy2: "#13386b",
  blue: "#4aa3ff", blueSoft: "#9fc4f0", red: "#e23b3b", white: "#ffffff", muted: "#8fa6c4",
};

// 25 posts (D-50..D-26): quotable line + pillar label.
const ITEMS = [
  ["D-50", "I don't just talk — I take action.", "MATT GRANT FOR CONGRESS"],
  ["D-49", "Show up. Do the work. Leave it better.", "A NEW STANDARD OF SERVICE"],
  ["D-48", "I know what families need — I'm raising one too.", "FAMILIES FIRST"],
  ["D-47", "The one fight no one else is having: clean up the family courts.", "CHILDREN FIRST"],
  ["D-46", "No clean courts, no check. Simple accountability.", "THE CHILD PROTECTION ACT"],
  ["D-45", "Term limits — including my own seat.", "TERM LIMITS"],
  ["D-44", "Right-size Washington before you ask families for another dime.", "SMALLER GOVERNMENT"],
  ["D-43", "Cut the waste first. Then talk tax rates.", "LOWER TAXES"],
  ["D-42", "Four fights worth winning.", "THE PLATFORM"],
  ["D-41", "You shouldn't need a fundraiser invitation to reach your Congressman.", "SHOW UP"],
  ["D-40", "I'm coming to your county. Every voice counts.", "EVERY COUNTY"],
  ["D-39", "Now someone is fighting for our kids.", "CHILDREN FIRST"],
  ["D-38", "Service isn't a slogan — it's a habit.", "PROVEN SERVICE"],
  ["D-37", "25 years winning by building coalitions.", "REAL RESULTS"],
  ["D-36", "Term limits break the cycle. I'll go first.", "TERM LIMITS"],
  ["D-35", "Find it. Cut it. Then lower the rates.", "LOWER TAXES"],
  ["D-34", "Smaller government, done right.", "SMALLER GOVERNMENT"],
  ["D-33", "The values I was raised on, carried into office.", "FAITH & COMMUNITY"],
  ["D-32", "Federal funds for clean courts only.", "CHILDREN FIRST"],
  ["D-31", "I'm not here to get comfortable.", "A NEW STANDARD"],
  ["D-30", "30 days. Make your plan to vote.", "AUGUST 4"],
  ["D-29", "Parents, I want to be your partner in Washington.", "FAMILIES FIRST"],
  ["D-28", "A dad first. That's why I'm running.", "MATT GRANT FOR CONGRESS"],
  ["D-27", "Term limits open the door. I'll hold it open.", "TERM LIMITS"],
  ["D-26", "Small business is the backbone of MO-02.", "LOWER TAXES"],
  ["D-25", "The new map made you MO-02. You're no afterthought.", "EVERY COUNTY"],
  ["D-24", "Protecting children isn't left or right. It's right and wrong.", "CHILDREN FIRST"],
  ["D-23", "Your dollars should go to your promises — not overhead.", "SMALLER GOVERNMENT"],
  ["D-22", "I don't take the easy fights.", "SHOW UP"],
  ["D-21", "Three weeks out. Check your registration today.", "AUGUST 4"],
  ["D-20", "Duty. Accountability. Finish the mission.", "VETERANS FOR GRANT"],
  ["D-19", "Action, not talk. That's the track record.", "PROVEN"],
  ["D-18", "Term limits. My seat included. Hold me to it.", "TERM LIMITS"],
  ["D-17", "Their bloat — not your paycheck.", "LOWER TAXES"],
  ["D-16", "Follow the dollars. Protect the kids.", "THE CHILD PROTECTION ACT"],
  ["D-15", "Two weeks. Make your plan to vote now.", "AUGUST 4"],
  ["D-14", "Outsiders win together. Join us.", "SHOW UP"],
  ["D-13", "Town halls — before AND after the election.", "SHOW UP"],
  ["D-12", "Smaller government is respect for your money.", "SMALLER GOVERNMENT"],
  ["D-11", "Not for a career — to fix four things and pass the torch.", "A NEW STANDARD"],
  ["D-10", "10 days. Bring someone with you to the polls.", "AUGUST 4"],
  ["D-9", "Make your plan now — before or after the shop.", "AUGUST 4"],
  ["D-8", "Need a ride to vote? Call (314) 255-7760.", "AUGUST 4"],
  ["D-7", "One week. Confirm your polling place tonight.", "AUGUST 4"],
  ["D-6", "The children-first vote you've been waiting for.", "CHILDREN FIRST"],
  ["D-5", "Outsiders win when we out-show-up.", "SHOW UP"],
  ["D-4", "Term limits. Smaller government. Lower taxes. Vote Aug 4.", "AUGUST 4"],
  ["D-3", "Be one of the people who shows up.", "SHOW UP"],
  ["D-2", "Tomorrow's the day. Know your place. Bring a friend.", "AUGUST 4"],
  ["D-1", "Election Day. Go vote — for a Congress that shows up.", "VOTE TODAY"],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function wrap(text, max) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max) {
      if (line) lines.push(line.trim());
      line = w;
    } else line += " " + w;
  }
  if (line) lines.push(line.trim());
  return lines;
}

function circle(size) {
  return Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
}

function buildSvg(quote, eyebrow) {
  // quote font scales down a touch for longer lines
  const fontSize = quote.length > 46 ? 58 : quote.length > 28 ? 66 : 76;
  const max = quote.length > 46 ? 24 : 20;
  const lines = wrap(quote, max);
  const lineH = fontSize * 1.16;
  const blockH = lines.length * lineH;
  const startY = 660 + (fontSize) - blockH / 2; // center the quote block around y~640
  const tspans = lines
    .map((l, i) => `<tspan x="540" dy="${i === 0 ? 0 : lineH}">${esc(l)}</tspan>`)
    .join("");

  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="34%" r="80%">
      <stop offset="0%" stop-color="${C.navy2}"/>
      <stop offset="55%" stop-color="${C.navy1}"/>
      <stop offset="100%" stop-color="${C.navy0}"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.blue}"/>
      <stop offset="100%" stop-color="${C.red}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- tech accent lines -->
  <g stroke="${C.blue}" stroke-opacity="0.16" stroke-width="2" fill="none">
    <path d="M0 150 L300 150 L340 110 L760 110"/>
    <path d="M1080 940 L780 940 L740 980 L300 980"/>
    <circle cx="540" cy="300" r="250" stroke-opacity="0.10"/>
  </g>
  <rect x="60" y="58" width="44" height="3" fill="${C.red}"/>
  <text x="118" y="70" font-family="Helvetica, Arial, sans-serif" font-size="26" letter-spacing="4" font-weight="700" fill="${C.blueSoft}">${esc(eyebrow)}</text>
  <!-- headshot ring (photo composited on top) -->
  <circle cx="540" cy="300" r="182" fill="none" stroke="url(#ring)" stroke-width="6"/>
  <circle cx="540" cy="300" r="196" fill="none" stroke="${C.blue}" stroke-opacity="0.22" stroke-width="2"/>
  <!-- quote -->
  <text x="540" y="${Math.round(startY)}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="${C.white}">${tspans}</text>
  <rect x="490" y="${Math.round(startY + blockH + 8)}" width="100" height="5" fill="${C.red}"/>
  <!-- footer -->
  <line x1="60" y1="980" x2="1020" y2="980" stroke="${C.blue}" stroke-opacity="0.25" stroke-width="2"/>
  <text x="60" y="1024" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="700" fill="${C.white}">MATT GRANT FOR CONGRESS <tspan fill="${C.blueSoft}" font-weight="400">· Missouri District 2</tspan></text>
  <text x="1020" y="1018" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="${C.red}">AUGUST 4, 2026</text>
  <text x="1020" y="1046" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="${C.muted}">Paid for by Matt Grant for Congress.</text>
  <text x="60" y="1052" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="${C.muted}">mattgrantforcongress.org</text>
</svg>`);
}

// Vertical 1080x1920 story version.
function buildStorySvg(quote, eyebrow) {
  const W2 = 1080, H2 = 1920;
  const fontSize = quote.length > 46 ? 72 : quote.length > 28 ? 82 : 92;
  const max = quote.length > 46 ? 22 : 18;
  const lines = wrap(quote, max);
  const lineH = fontSize * 1.16;
  const blockH = lines.length * lineH;
  const startY = 1120 + fontSize - blockH / 2;
  const tspans = lines.map((l, i) => `<tspan x="540" dy="${i === 0 ? 0 : lineH}">${esc(l)}</tspan>`).join("");
  return Buffer.from(`<svg width="${W2}" height="${H2}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="${C.navy2}"/><stop offset="55%" stop-color="${C.navy1}"/><stop offset="100%" stop-color="${C.navy0}"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${C.blue}"/><stop offset="100%" stop-color="${C.red}"/></linearGradient>
  </defs>
  <rect width="${W2}" height="${H2}" fill="url(#bg)"/>
  <g stroke="${C.blue}" stroke-opacity="0.14" stroke-width="2" fill="none">
    <path d="M0 230 L300 230 L340 190 L820 190"/>
    <circle cx="540" cy="620" r="300" stroke-opacity="0.10"/>
  </g>
  <rect x="80" y="150" width="48" height="3" fill="${C.red}"/>
  <text x="146" y="162" font-family="Helvetica, Arial, sans-serif" font-size="28" letter-spacing="4" font-weight="700" fill="${C.blueSoft}">${esc(eyebrow)}</text>
  <circle cx="540" cy="620" r="244" fill="none" stroke="url(#ring)" stroke-width="7"/>
  <circle cx="540" cy="620" r="260" fill="none" stroke="${C.blue}" stroke-opacity="0.22" stroke-width="2"/>
  <text x="540" y="${Math.round(startY)}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="${C.white}">${tspans}</text>
  <rect x="480" y="${Math.round(startY + blockH + 16)}" width="120" height="6" fill="${C.red}"/>
  <line x1="80" y1="1740" x2="1000" y2="1740" stroke="${C.blue}" stroke-opacity="0.25" stroke-width="2"/>
  <text x="540" y="1800" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="${C.white}">MATT GRANT FOR CONGRESS · MO-02</text>
  <text x="540" y="1846" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="${C.red}">AUGUST 4, 2026</text>
  <text x="540" y="1884" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="${C.muted}">mattgrantforcongress.org · Paid for by Matt Grant for Congress.</text>
</svg>`);
}

async function main() {
  const feedDir = path.join(OUT, "feed"), storyDir = path.join(OUT, "stories");
  await mkdir(feedDir, { recursive: true });
  await mkdir(storyDir, { recursive: true });
  const D = 364, DS = 488; // square + story photo diameters
  const photoSq = await sharp(SRC).resize(D, D, { fit: "cover", position: "north" }).composite([{ input: circle(D), blend: "dest-in" }]).png().toBuffer();
  const photoSt = await sharp(SRC).resize(DS, DS, { fit: "cover", position: "north" }).composite([{ input: circle(DS), blend: "dest-in" }]).png().toBuffer();
  for (const [id, quote, eyebrow] of ITEMS) {
    await sharp(buildSvg(quote, eyebrow)).composite([{ input: photoSq, top: 300 - D / 2, left: 540 - D / 2 }]).png().toFile(path.join(feedDir, `${id}.png`));
    await sharp(buildStorySvg(quote, eyebrow)).composite([{ input: photoSt, top: 620 - DS / 2, left: 540 - DS / 2 }]).png().toFile(path.join(storyDir, `${id}.png`));
  }
  console.log(`\nGenerated ${ITEMS.length} feed + ${ITEMS.length} story graphics in ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
