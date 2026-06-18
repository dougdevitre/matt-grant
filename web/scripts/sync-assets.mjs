// Idempotent importer: maps the campaign originals in ~/Downloads/grant-assets
// into the single S3 source of truth (matt-grant-for-congress), under the
// public/ + private/ taxonomy. Skips .DS_Store. Re-runnable.
//
//   node scripts/sync-assets.mjs --dry-run     # print the source→key map, upload nothing
//   node scripts/sync-assets.mjs               # upload via the AWS CLI
//   node scripts/sync-assets.mjs --src /path/to/grant-assets
//
// Decisions baked in (confirmed): videos → public/video (CDN); school data +
// shapefiles → private/data; the "without logo" deck master → private/raw.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const srcFlag = args.indexOf("--src");
const SRC = srcFlag >= 0 ? args[srcFlag + 1] : path.join(os.homedir(), "Downloads", "grant-assets");
const BUCKET = "matt-grant-for-congress";

const CT = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".pdf": "application/pdf",
  ".mp4": "video/mp4", ".shp": "application/octet-stream", ".dbf": "application/octet-stream",
  ".shx": "application/octet-stream", ".prj": "text/plain", ".cpg": "text/plain", ".xml": "application/xml",
};
const slug = (s) => s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ---- build the source → key map ----
const MAP = []; // { src (abs), key, ct }
const add = (rel, key) => {
  const abs = path.join(SRC, rel);
  if (!existsSync(abs)) { console.warn(`  ! missing source: ${rel}`); return; }
  MAP.push({ src: abs, key, ct: CT[path.extname(abs).toLowerCase()] || "application/octet-stream" });
};

const files = existsSync(SRC) ? readdirSync(SRC) : [];

// 16 flyers → public/marketing/flyers/
for (const f of files.filter((f) => /_Flyer_.*\.png$/.test(f)))
  add(f, `public/marketing/flyers/mg-flyer-${slug(f.replace(/^.*_Flyer_/, ""))}.png`);

// videos → public/video/
const VIDEOS = {
  "Matt_Grant_for_Congress_Intro_Animation_Missouri.mp4": "public/video/mg-video-intro-animation.mp4",
  "Matt_Grant_for_Congress_Logo_Animation.mp4": "public/video/mg-video-logo-animation.mp4",
  "Matt Grant - Fixing Missouris Broken System (small).mp4": "public/video/mg-video-fixing-missouris-broken-system.mp4",
};
for (const [f, k] of Object.entries(VIDEOS)) add(f, k);

// 12 Mandate deck slides → public/marketing/deck/mandate/
const slides = "Matt_Grant_For_Congress_2026_Mandate/Presentation_Slides";
if (existsSync(path.join(SRC, slides)))
  for (const f of readdirSync(path.join(SRC, slides)).filter((f) => f.endsWith(".jpg"))) {
    const n = (f.match(/_Page_(\d+)/) || [])[1] || "00";
    add(path.join(slides, f), `public/marketing/deck/mandate/page-${n}.jpg`);
  }

// brand: white logo + lockup + icons (public); hi-res color masters (private/raw)
add("Matt_Grant_for_Congress_White.png", "public/brand/logo-white.png");
add("Matt_Grant_for_Congress_Logo_Lockup_Variations.png", "public/brand/logo-lockup.png");
add("Matt_Grant_for_Congress.png", "public/brand/icons/icon-256.png");
add("Matt_Grant_for_Congress.jpg", "public/brand/icons/icon-256.jpg");
add("Matt_Grant_for_Congress_Blue.png", "private/raw/logo/logo-blue-1254.png");
add("Matt_Grant_for_Congress_Red.png", "private/raw/logo/logo-red-1254.png");
add("Matt_Grant_for_Congress_White.png", "private/raw/logo/logo-white-1254.png");

// web imagery → public/web/
add("Matt_Grant_for_Congress_Dashboard_Built_to_Win.png", "public/web/dashboard-built-to-win.png");
add("Matt_Grant_for_Congress_Dashboard_Campaign_War_Room.png", "public/web/dashboard-war-room.png");
add("Matt_Grant_for_Congress_St_Louis_Arch.png", "public/web/st-louis-arch.png");

// full-res masters → private/raw/
add("Matt_Grant_for_Congress_Infographic.png", "private/raw/infographic-2752.png");
add("A_New_Standard_of_Service.png", "private/raw/banner-standard-of-service-2752.png");
add("The_Grant_Campaign_Engine without logo.pdf", "private/raw/deck/grant-campaign-engine-without-logo.pdf");

// research data + geo → private/data/
add("Missouri School Statistics 24-25.pdf", "private/data/missouri-school-statistics-2024-25.pdf");
for (const [dir, dest] of [
  ["Missouri_Public_Schools_-7090903580792779543", "public-school-districts"],
  ["Missouri_Public_Schools_3701114636792196280", "public-schools"],
]) {
  const d = path.join(SRC, dir);
  if (existsSync(d)) for (const f of readdirSync(d).filter((f) => f !== ".DS_Store"))
    add(path.join(dir, f), `private/data/geo/${dest}/${f.replace(/^Public_School[s]?_?(Districts)?/i, dest)}`);
}

// ---- report + upload ----
MAP.sort((a, b) => a.key.localeCompare(b.key));
let bytes = 0;
for (const m of MAP) bytes += statSync(m.src).size;
console.log(`\n${MAP.length} objects, ${(bytes / 1e6).toFixed(1)} MB → s3://${BUCKET}\n`);
for (const m of MAP) console.log(`  ${m.key.startsWith("private/") ? "🔒" : "🌐"}  ${m.key}`);

if (DRY) { console.log("\n(dry run — nothing uploaded)"); process.exit(0); }

console.log("\nuploading…");
for (const m of MAP) {
  execFileSync("aws", ["s3", "cp", m.src, `s3://${BUCKET}/${m.key}`, "--content-type", m.ct,
    "--cache-control", "public, max-age=604800, immutable", "--only-show-errors"],
    { stdio: "inherit", env: { ...process.env, AWS_DEFAULT_REGION: "us-east-1", AWS_PAGER: "" } });
}
console.log(`\n✓ synced ${MAP.length} objects`);
