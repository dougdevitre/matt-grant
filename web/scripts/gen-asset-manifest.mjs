// Generates web/lib/assets.manifest.json — the as-code index of every PUBLIC
// object in the S3 source of truth (the recoverable catalog the app + MCP read).
// Private objects are intentionally excluded; they are never indexed publicly.
//
//   node scripts/gen-asset-manifest.mjs
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const BUCKET = "matt-grant-for-congress";
const CDN = "https://d5jzyan9wboi3.cloudfront.net";

const out = execFileSync("aws", ["s3api", "list-objects-v2", "--bucket", BUCKET, "--prefix", "public/",
  "--query", "Contents[].{key:Key,bytes:Size}", "--output", "json"],
  { env: { ...process.env, AWS_DEFAULT_REGION: "us-east-1", AWS_PAGER: "" } }).toString();

const objs = JSON.parse(out).filter((o) => !o.key.endsWith("/") && !o.key.endsWith(".keep"));
const titleize = (k) => path.basename(k).replace(/\.[^.]+$/, "")
  .replace(/^mg-(flyer|video|print)-/, "").replace(/[-_]+/g, " ")
  .replace(/\b\w/g, (c) => c.toUpperCase());

// group by second path segment: public/<group>/...
const groups = {};
for (const o of objs) {
  const g = o.key.split("/")[1] || "misc";
  (groups[g] ||= []).push({ key: o.key, url: `${CDN}/${o.key}`, label: titleize(o.key), bytes: o.bytes });
}
for (const g of Object.values(groups)) g.sort((a, b) => a.key.localeCompare(b.key));

const manifest = {
  bucket: BUCKET, cdn: CDN, count: objs.length,
  bytes: objs.reduce((n, o) => n + o.bytes, 0), groups,
};
const dest = path.join(process.cwd(), "lib", "assets.manifest.json");
await writeFile(dest, JSON.stringify(manifest, null, 2) + "\n");
console.log(`✓ ${objs.length} public objects across ${Object.keys(groups).length} groups → lib/assets.manifest.json`);
