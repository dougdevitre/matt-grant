// Ingest real shoot photos into the PRIVATE library
// (s3://matt-grant-for-congress/private/photos/<category>/). Private = signed-URL
// only; CloudFront cannot serve these. Promote chosen shots to the public site
// with promote-photo.mjs.
//
//   node scripts/sync-photos.mjs --src ~/Downloads/shoot --category events
//   node scripts/sync-photos.mjs --src ~/Downloads/shoot --category events --dry-run
//
// Categories: candidate | family | events | district | broll
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const get = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes("--dry-run");
const SRC = get("--src");
const CATEGORY = get("--category");
const BUCKET = "matt-grant-for-congress";
const CATS = ["candidate", "family", "events", "district", "broll"];

if (!SRC || !existsSync(SRC)) { console.error("Pass --src <folder> (an existing directory)."); process.exit(1); }
if (!CATS.includes(CATEGORY)) { console.error(`Pass --category one of: ${CATS.join(", ")}`); process.exit(1); }

const CT = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".heic": "image/heic", ".webp": "image/webp", ".tif": "image/tiff", ".tiff": "image/tiff" };
const slug = (s) => s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const files = readdirSync(SRC).filter((f) => CT[path.extname(f).toLowerCase()] && f !== ".DS_Store");
if (!files.length) { console.error("No images found in --src."); process.exit(1); }

const map = files.map((f) => {
  const ext = path.extname(f).toLowerCase();
  return { src: path.join(SRC, f), key: `private/photos/${CATEGORY}/mg-${CATEGORY}-${slug(f)}${ext}`, ct: CT[ext] };
});

let bytes = 0;
for (const m of map) bytes += statSync(m.src).size;
console.log(`\n${map.length} photos, ${(bytes / 1e6).toFixed(1)} MB → s3://${BUCKET}/private/photos/${CATEGORY}/\n`);
for (const m of map) console.log(`  🔒 ${m.key}`);
if (DRY) { console.log("\n(dry run — nothing uploaded)"); process.exit(0); }

console.log("\nuploading…");
for (const m of map) {
  execFileSync("aws", ["s3", "cp", m.src, `s3://${BUCKET}/${m.key}`, "--content-type", m.ct, "--only-show-errors"],
    { stdio: "inherit", env: { ...process.env, AWS_DEFAULT_REGION: "us-east-1", AWS_PAGER: "" } });
}
console.log(`\n✓ synced ${map.length} photos (private — signed-URL only)`);
