// Add photos to the homepage carousel — one command, end to end.
//
// This is a thin orchestrator over the existing pipeline (sync-photos.mjs +
// promote-photo.mjs). It reads a small config file, uploads the raw originals to
// the PRIVATE library, promotes+optimizes each chosen shot to the public CDN
// (sharp → 1600/800/OG JPEG, mozjpeg q84 — the "smush"), and finally prints the
// ready-to-paste HOME_CAROUSEL block for web/lib/site.ts.
//
// PREREQS (run locally, not in a sandbox): the AWS CLI installed and
// authenticated for an identity with s3:PutObject/GetObject/ListBucket on the
// bucket `matt-grant-for-congress` (us-east-1) — via AWS_PROFILE or
// AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY. Run from the `web/` directory.
//
// USAGE
//   1. Copy the example config and edit it:
//        cp scripts/carousel-photos.example.json scripts/carousel-photos.json
//   2. Point `src` at your folder of photos and list each photo you want featured.
//   3. Dry run (no uploads — validates + prints the plan):
//        node scripts/add-carousel-photos.mjs --config scripts/carousel-photos.json --dry-run
//   4. For real:
//        node scripts/add-carousel-photos.mjs --config scripts/carousel-photos.json
//   5. Paste the printed HOME_CAROUSEL block into web/lib/site.ts, then commit
//        web/lib/webPhotos.json + web/lib/site.ts.
//
// CONFIG SHAPE (scripts/carousel-photos.example.json)
//   {
//     "src": "~/Downloads/shoot",            // folder holding the raw photos
//     "category": "events",                  // candidate | family | events | district | broll
//     "photos": [
//       { "file": "DSC_0421.jpg", "name": "rally-wildwood",
//         "caption": "On the trail in Wildwood", "alt": "Matt greeting supporters at a rally" }
//     ]
//   }
//   - file:    the filename inside `src` (exactly as on disk)
//   - name:    slug used for the public asset + carousel reference (unique, kebab-case)
//   - alt:     REQUIRED — a plain description, used as the image alt text (accessibility)
//   - caption: OPTIONAL — text shown over the slide

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const get = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes("--dry-run");
const CONFIG = get("--config");
const CATS = ["candidate", "family", "events", "district", "broll"];
const SCRIPTS = path.dirname(new URL(import.meta.url).pathname);

// Mirror sync-photos.mjs's slug rule so we can predict the private key it writes.
const slug = (s) => s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const expandHome = (p) => (p.startsWith("~") ? path.join(homedir(), p.slice(1)) : p);

function fail(msg) { console.error(`\n✖ ${msg}\n`); process.exit(1); }

if (!CONFIG) fail("Pass --config <file>. Start from scripts/carousel-photos.example.json.");
if (!existsSync(CONFIG)) fail(`Config not found: ${CONFIG}`);

let cfg;
try { cfg = JSON.parse(readFileSync(CONFIG, "utf8")); }
catch (e) { fail(`Config is not valid JSON: ${e.message}`); }

const SRC = cfg.src ? expandHome(String(cfg.src)) : undefined;
const CATEGORY = cfg.category;
const PHOTOS = Array.isArray(cfg.photos) ? cfg.photos : [];

if (!SRC || !existsSync(SRC)) fail(`config.src must be an existing folder (got: ${cfg.src ?? "—"}).`);
if (!CATS.includes(CATEGORY)) fail(`config.category must be one of: ${CATS.join(", ")}`);
if (!PHOTOS.length) fail("config.photos is empty — list at least one { file, name, alt }.");

// Validate every photo entry before doing any work.
const names = new Set();
PHOTOS.forEach((p, i) => {
  const where = `photos[${i}]`;
  if (!p.file) fail(`${where}: missing "file".`);
  if (!existsSync(path.join(SRC, p.file))) fail(`${where}: "${p.file}" not found in ${SRC}.`);
  if (!p.name || !/^[a-z0-9-]+$/.test(p.name)) fail(`${where}: "name" must be kebab-case [a-z0-9-] (got: ${p.name ?? "—"}).`);
  if (names.has(p.name)) fail(`${where}: duplicate name "${p.name}".`);
  names.add(p.name);
  if (!p.alt || !String(p.alt).trim()) fail(`${where} ("${p.name}"): "alt" is required (accessibility).`);
});

// Resolve the private key sync-photos.mjs will create for each configured file.
const plan = PHOTOS.map((p) => {
  const ext = path.extname(p.file).toLowerCase();
  return { ...p, key: `private/photos/${CATEGORY}/mg-${CATEGORY}-${slug(p.file)}${ext}` };
});

console.log(`\nCarousel photo helper — ${plan.length} photo(s), category "${CATEGORY}"`);
console.log(`Source: ${SRC}\n`);
plan.forEach((p) => console.log(`  • ${p.file}  →  ${p.name}\n      key: ${p.key}\n      alt: ${p.alt}${p.caption ? `\n      caption: ${p.caption}` : ""}`));

function carouselSnippet() {
  const lines = plan.map((p) =>
    `  { name: ${JSON.stringify(p.name)}${p.caption ? `, caption: ${JSON.stringify(p.caption)}` : ""} },`);
  return [
    "\n// Paste into HOME_CAROUSEL in web/lib/site.ts (order = display order):",
    "export const HOME_CAROUSEL: readonly { name: string; caption?: string }[] = [",
    ...lines,
    "];",
  ].join("\n");
}

function node(script, scriptArgs) {
  execFileSync("node", [path.join(SCRIPTS, script), ...scriptArgs], { stdio: "inherit" });
}

if (DRY) {
  console.log("\n(dry run) — would run:");
  console.log(`  node scripts/sync-photos.mjs --src ${SRC} --category ${CATEGORY} --dry-run`);
  plan.forEach((p) =>
    console.log(`  node scripts/promote-photo.mjs --key ${p.key} --name ${p.name} --alt ${JSON.stringify(p.alt)}`));
  // Prove sync-photos agrees with our predicted keys (it also runs in dry mode).
  node("sync-photos.mjs", ["--src", SRC, "--category", CATEGORY, "--dry-run"]);
  console.log(carouselSnippet());
  console.log("\n(dry run — nothing uploaded)\n");
  process.exit(0);
}

// 1) Stage all originals in the folder to the private library.
console.log("\n① Uploading originals to the private library…");
node("sync-photos.mjs", ["--src", SRC, "--category", CATEGORY]);

// 2) Promote + optimize each chosen shot to the public CDN.
console.log("\n② Promoting + optimizing chosen photos…");
for (const p of plan) {
  node("promote-photo.mjs", ["--key", p.key, "--name", p.name, "--alt", p.alt]);
}

// 3) Print the block to paste.
console.log("\n③ Done. lib/webPhotos.json now has the promoted photos.");
console.log(carouselSnippet());
console.log("\nNext: paste that block into web/lib/site.ts, then commit web/lib/webPhotos.json + web/lib/site.ts.\n");
