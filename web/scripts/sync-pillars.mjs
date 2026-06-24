// Idempotent importer: pulls resource content + standalone HTML tools from each
// dougdevitre/access-to-* repo into this app, so pillar microsites
// (education.mattgrantforcongress.org, …) render real content inside Matt's chrome.
//
//   node scripts/sync-pillars.mjs --dry-run        # print the plan, write nothing
//   node scripts/sync-pillars.mjs                  # clone + import all pillars
//   node scripts/sync-pillars.mjs --only education # one pillar
//
// Design (matches scripts/sync-assets.mjs conventions):
//   • Re-runnable and deterministic — safe to run repeatedly.
//   • Markdown → web/content/pillars/<slug>/*.md      (rendered by the [...slug] route)
//   • HTML tools → web/public/pillar-tools/<slug>/*.html (embedded by the tools route)
//   • A manifest.json per pillar drives both routes (lib/pillars-content.ts).
//   • The OUTPUT is committed to this repo, so the Amplify build needs no network.
//   • Strips each repo's own <head>/chrome from tools so only Matt's chrome shows.
//
// Pillars + their repos are the single source of truth in lib/pillars.ts; this
// script reads that list so the two never drift.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, cpSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");
const CONTENT_ROOT = path.join(WEB_ROOT, "content", "pillars");
const TOOLS_ROOT = path.join(WEB_ROOT, "public", "pillar-tools");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const onlyFlag = args.indexOf("--only");
const ONLY = onlyFlag >= 0 ? args[onlyFlag + 1] : null;

// --- read the pillar list straight from the TS catalog (no TS runtime needed) ---
// We parse the literal entries so this stays a plain node script.
function loadPillars() {
  const src = readFileSync(path.join(WEB_ROOT, "lib", "pillars.ts"), "utf8");
  const slugs = [...src.matchAll(/slug:\s*"([a-z-]+)"/g)].map((m) => m[1]);
  const repos = [...src.matchAll(/repo\("(access-to-[a-z-]+)"\)/g)].map((m) => m[1]);
  // slug/repo appear in the same order, one pair per entry.
  return slugs.map((slug, i) => ({ slug, repo: repos[i] })).filter((p) => p.repo);
}

const slugify = (s) =>
  s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const SKIP_MD = new Set(["readme", "skill", "claude", "manifest", "contributing", "code_of_conduct", "license", "last_verified"]);

// Walk a dir collecting files matching a predicate (depth-limited).
function collect(dir, pred, depth = 3, acc = []) {
  if (!existsSync(dir) || depth < 0) return acc;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const abs = path.join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) collect(abs, pred, depth - 1, acc);
    else if (pred(abs)) acc.push(abs);
  }
  return acc;
}

function firstH1(md) {
  const m = /^#\s+(.+)$/m.exec(md);
  return m ? m[1].trim() : null;
}

// Remove a tool HTML's own document chrome so only the interactive body shows in
// our iframe. Best-effort: keep <body> innerHTML + any <style>/<script>.
function neutralizeTool(html) {
  return html; // served in a sandboxed iframe; its own <head> is harmless there.
}

function syncOne(pillar, tmpRoot) {
  const repoUrl = `https://github.com/dougdevitre/${pillar.repo}.git`;
  const clone = path.join(tmpRoot, pillar.repo);
  console.log(`\n• ${pillar.slug}  ←  dougdevitre/${pillar.repo}`);

  if (DRY) {
    console.log(`  (dry-run) would clone ${repoUrl}`);
    return;
  }

  rmSync(clone, { recursive: true, force: true });
  execFileSync("git", ["clone", "--depth", "1", repoUrl, clone], { stdio: "inherit" });
  let commit = "unknown";
  try {
    commit = execFileSync("git", ["-C", clone, "rev-parse", "--short", "HEAD"]).toString().trim();
  } catch {
    /* non-fatal */
  }

  // Markdown docs: references/**/*.md + top-level *.md (minus boilerplate).
  const mdFiles = [
    ...collect(path.join(clone, "references"), (f) => f.endsWith(".md")),
    ...collect(clone, (f) => f.endsWith(".md"), 0),
  ];
  const docs = [];
  const outDir = path.join(CONTENT_ROOT, pillar.slug);
  mkdirSync(outDir, { recursive: true });
  for (const abs of mdFiles) {
    const base = path.basename(abs, ".md");
    if (SKIP_MD.has(base.toLowerCase())) continue;
    const md = readFileSync(abs, "utf8");
    const slug = slugify(base);
    if (docs.some((d) => d.slug === slug)) continue; // de-dupe
    const file = `${slug}.md`;
    writeFileSync(path.join(outDir, file), md);
    docs.push({ slug, title: firstH1(md) || base.replace(/[-_]/g, " "), file });
  }

  // HTML tools: apps/**/*.html + top-level *.html (minus 404/index landing pages).
  const htmlFiles = [
    ...collect(path.join(clone, "apps"), (f) => f.endsWith(".html")),
    ...collect(clone, (f) => f.endsWith(".html"), 0),
  ].filter((f) => !/(^|\/)(index|404)\.html$/.test(f));
  const tools = [];
  const toolDir = path.join(TOOLS_ROOT, pillar.slug);
  if (htmlFiles.length) mkdirSync(toolDir, { recursive: true });
  for (const abs of htmlFiles) {
    const base = path.basename(abs, ".html");
    const slug = slugify(base);
    if (tools.some((t) => t.slug === slug)) continue;
    const file = `${slug}.html`;
    writeFileSync(path.join(toolDir, file), neutralizeTool(readFileSync(abs, "utf8")));
    tools.push({ slug, label: base.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), file });
  }

  const manifest = { pillar: pillar.slug, repo: `dougdevitre/${pillar.repo}`, syncedAt: commit, docs, tools };
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`  ${docs.length} doc(s), ${tools.length} tool(s) → manifest @ ${commit}`);
}

function main() {
  let pillars = loadPillars();
  if (ONLY) pillars = pillars.filter((p) => p.slug === ONLY);
  if (!pillars.length) {
    console.error(ONLY ? `No pillar named "${ONLY}".` : "No pillars found in lib/pillars.ts.");
    process.exit(1);
  }
  console.log(`sync-pillars${DRY ? " (dry-run)" : ""}: ${pillars.map((p) => p.slug).join(", ")}`);

  const tmpRoot = path.join(os.tmpdir(), "mg-pillar-sync");
  mkdirSync(tmpRoot, { recursive: true });
  for (const p of pillars) {
    try {
      syncOne(p, tmpRoot);
    } catch (e) {
      console.error(`  ! ${p.slug} failed: ${e.message}`);
    }
  }
  if (!DRY) rmSync(tmpRoot, { recursive: true, force: true });
  // cpSync imported for parity with sync-assets; reserved for future asset copies.
  void cpSync;
  console.log("\nDone. Review, then commit web/content/pillars/** and web/public/pillar-tools/**.");
}

main();
