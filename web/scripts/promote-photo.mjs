// Promote ONE chosen private photo to the public site: download the original,
// render web-optimized derivatives (1600w + 800w + 1200x630 OG), upload to
// public/web/photos/, and record it in lib/webPhotos.json so pages can use it.
//
//   node scripts/promote-photo.mjs --key private/photos/events/mg-events-rally.jpg \
//        --name district-rally --alt "Matt with supporters in Wildwood"
//
// Re-run to refresh a promotion; pass --remove --name <name> to drop one.
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const get = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const REMOVE = args.includes("--remove");
const KEY = get("--key");
const NAME = get("--name");
const ALT = get("--alt") ?? "";
const BUCKET = "matt-grant-for-congress";
const CDN = "https://d5jzyan9wboi3.cloudfront.net";
const MANIFEST = path.join(process.cwd(), "lib", "webPhotos.json");
const ENV = { ...process.env, AWS_DEFAULT_REGION: "us-east-1", AWS_PAGER: "" };

if (!NAME) { console.error("Pass --name <slug>."); process.exit(1); }

async function loadManifest() {
  if (existsSync(MANIFEST)) return JSON.parse(await readFile(MANIFEST, "utf8"));
  return { cdn: CDN, photos: [] };
}

async function main() {
  const manifest = await loadManifest();
  manifest.cdn = CDN;

  if (REMOVE) {
    manifest.photos = manifest.photos.filter((p) => p.name !== NAME);
    await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`✓ removed "${NAME}" from the manifest (S3 objects left in place)`);
    return;
  }

  if (!KEY) { console.error("Pass --key private/photos/<...>."); process.exit(1); }
  const tmp = "/tmp/promote-photo";
  await mkdir(tmp, { recursive: true });
  const orig = path.join(tmp, "orig");
  execFileSync("aws", ["s3", "cp", `s3://${BUCKET}/${KEY}`, orig, "--only-show-errors"], { stdio: "inherit", env: ENV });

  const variants = [
    { suffix: "1600", w: 1600, h: null },
    { suffix: "800", w: 800, h: null },
    { suffix: "og", w: 1200, h: 630 },
  ];
  const sizes = {};
  for (const v of variants) {
    const out = path.join(tmp, `${NAME}-${v.suffix}.jpg`);
    const pipe = sharp(orig).rotate();
    if (v.h) pipe.resize(v.w, v.h, { fit: "cover", position: "attention" });
    else pipe.resize(v.w, null, { withoutEnlargement: true });
    await pipe.jpeg({ quality: 84, mozjpeg: true }).toFile(out);
    const dest = `public/web/photos/${NAME}-${v.suffix}.jpg`;
    execFileSync("aws", ["s3", "cp", out, `s3://${BUCKET}/${dest}`, "--content-type", "image/jpeg",
      "--cache-control", "public, max-age=604800", "--only-show-errors"], { stdio: "inherit", env: ENV });
    sizes[v.suffix] = `${CDN}/${dest}`;
  }
  await rm(tmp, { recursive: true, force: true });

  manifest.photos = manifest.photos.filter((p) => p.name !== NAME);
  manifest.photos.push({ name: NAME, alt: ALT, source: KEY, sizes });
  manifest.photos.sort((a, b) => a.name.localeCompare(b.name));
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\n✓ promoted "${NAME}" → public/web/photos/ (1600 + 800 + og); manifest updated.`);
  console.log(`  use: <Image src="${sizes["1600"]}" alt="${ALT}" ... />`);
}
main();
