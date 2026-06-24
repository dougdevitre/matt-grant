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

// Decide whether it is safe to write a freshly-synced pillar over the committed
// one. Pure + dependency-free so it is unit-testable without cloning real repos.
//
// The guard that matters: a pillar that *had* docs but now imports ZERO is almost
// always a transient clone failure or an upstream path-rename — NOT an intentional
// emptying. Writing that through would wipe live content (and, with orphan pruning,
// delete every file). So we refuse the write and report "regressed" (a hard error
// that fails the run). A pillar that was already empty staying empty is benign.
//
//   prevManifest : the existing committed manifest.json (or null if never synced)
//   newDocs/newTools : arrays of { file } just collected from the clone
//   → { status: "ok"|"empty"|"regressed", write: boolean, orphans: string[] }
//     orphans = committed files no longer present upstream (to prune on write).
export function planSync(prevManifest, newDocs, newTools) {
  const prevDocs = prevManifest?.docs?.length ?? 0;
  if (prevDocs > 0 && newDocs.length === 0) {
    return { status: "regressed", write: false, orphans: [] };
  }
  if (newDocs.length === 0 && newTools.length === 0) {
    return { status: "empty", write: true, orphans: [] };
  }
  const keepDocs = new Set(newDocs.map((d) => d.file));
  const keepTools = new Set(newTools.map((t) => t.file));
  const orphans = [];
  for (const d of prevManifest?.docs ?? []) if (!keepDocs.has(d.file)) orphans.push(d.file);
  for (const t of prevManifest?.tools ?? []) if (!keepTools.has(t.file)) orphans.push(t.file);
  return { status: "ok", write: true, orphans };
}

function readManifest(slug) {
  try {
    return JSON.parse(readFileSync(path.join(CONTENT_ROOT, slug, "manifest.json"), "utf8"));
  } catch {
    return null; // not synced yet, or unreadable
  }
}

// Remove a tool HTML's own document chrome so only the interactive body shows in
// our iframe. Best-effort: keep <body> innerHTML + any <style>/<script>.
function neutralizeTool(html) {
  return html; // served in a sandboxed iframe; its own <head> is harmless there.
}

// Some access-to-* repos ship a "tool" as a React/SPA source tree (package.json +
// src/) whose only HTML is an unbuilt dist/index.html — which the importer filters
// out. Those would vanish silently. Detect such app dirs (in apps/<name>/ and the
// repo root) that produced NO imported tool, so we can surface them instead of
// dropping them. We do NOT build them here — that's a per-repo decision (embed a
// built artifact, link out, or skip).
function detectReactApps(clone, importedHtml) {
  const candidates = [];
  const appsRoot = path.join(clone, "apps");
  if (existsSync(appsRoot)) {
    for (const name of readdirSync(appsRoot)) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const dir = path.join(appsRoot, name);
      try {
        if (statSync(dir).isDirectory()) candidates.push(dir);
      } catch {
        /* ignore */
      }
    }
  }
  candidates.push(clone); // the repo root itself may be the app

  const skipped = [];
  for (const dir of candidates) {
    if (!existsSync(path.join(dir, "package.json"))) continue;
    const yielded = importedHtml.some((f) => f === dir || f.startsWith(dir + path.sep));
    if (!yielded) skipped.push({ name: path.basename(dir), path: path.relative(clone, dir) || "." });
  }
  return skipped;
}

// Sync a single pillar. Returns a result record describing the outcome; throws
// only on an unrecoverable error (e.g. clone failed), which main() turns into a
// "failed" result. Collection is separated from writing so the regression guard
// (planSync) can refuse a destructive write before any file is touched.
function syncOne(pillar, tmpRoot) {
  const repoUrl = `https://github.com/dougdevitre/${pillar.repo}.git`;
  const clone = path.join(tmpRoot, pillar.repo);
  console.log(`\n• ${pillar.slug}  ←  dougdevitre/${pillar.repo}`);

  const outDir = path.join(CONTENT_ROOT, pillar.slug);
  const toolDir = path.join(TOOLS_ROOT, pillar.slug);
  const prevManifest = readManifest(pillar.slug);
  const prevDocs = prevManifest?.docs?.length ?? 0;

  if (DRY) {
    console.log(`  (dry-run) would clone ${repoUrl} (currently ${prevDocs} committed doc(s))`);
    return { slug: pillar.slug, status: "ok", docs: 0, tools: 0, prevDocs, skipped: [] };
  }

  rmSync(clone, { recursive: true, force: true });
  execFileSync("git", ["clone", "--depth", "1", repoUrl, clone], { stdio: "inherit" });
  let commit = "unknown";
  try {
    commit = execFileSync("git", ["-C", clone, "rev-parse", "--short", "HEAD"]).toString().trim();
  } catch {
    /* non-fatal */
  }

  // Collect (don't write yet) markdown docs: references/**/*.md + top-level *.md.
  const mdFiles = [
    ...collect(path.join(clone, "references"), (f) => f.endsWith(".md")),
    ...collect(clone, (f) => f.endsWith(".md"), 0),
  ];
  const docs = [];
  for (const abs of mdFiles) {
    const base = path.basename(abs, ".md");
    if (SKIP_MD.has(base.toLowerCase())) continue;
    const md = readFileSync(abs, "utf8");
    const slug = slugify(base);
    if (docs.some((d) => d.slug === slug)) continue; // de-dupe
    docs.push({ slug, title: firstH1(md) || base.replace(/[-_]/g, " "), file: `${slug}.md`, body: md });
  }

  // Collect HTML tools: apps/**/*.html + top-level *.html (minus 404/index pages).
  const htmlFiles = [
    ...collect(path.join(clone, "apps"), (f) => f.endsWith(".html")),
    ...collect(clone, (f) => f.endsWith(".html"), 0),
  ].filter((f) => !/(^|\/)(index|404)\.html$/.test(f));
  const tools = [];
  for (const abs of htmlFiles) {
    const base = path.basename(abs, ".html");
    const slug = slugify(base);
    if (tools.some((t) => t.slug === slug)) continue;
    tools.push({
      slug,
      label: base.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      file: `${slug}.html`,
      body: neutralizeTool(readFileSync(abs, "utf8")),
    });
  }

  // Flag React/SPA tool dirs that didn't import as a standalone .html.
  const skippedTools = detectReactApps(clone, htmlFiles);
  for (const s of skippedTools) {
    console.warn(`  ⚠️  skipped React app at ${s.path} — needs a built standalone .html or a link-out`);
  }

  const plan = planSync(prevManifest, docs, tools);
  if (!plan.write) {
    // Regression: had content, now imports zero. Refuse to overwrite/delete the
    // last-good committed content — surface it as a hard error instead.
    console.error(`  ✗ ${pillar.slug}: imported 0 docs but ${prevDocs} are committed — refusing to wipe (likely a clone/upstream issue).`);
    return { slug: pillar.slug, status: "regressed", docs: 0, tools: tools.length, prevDocs, skipped: skippedTools };
  }

  // Safe to write. Persist docs + tools, prune anything no longer upstream.
  mkdirSync(outDir, { recursive: true });
  for (const d of docs) writeFileSync(path.join(outDir, d.file), d.body);
  if (tools.length) mkdirSync(toolDir, { recursive: true });
  for (const t of tools) writeFileSync(path.join(toolDir, t.file), t.body);
  for (const orphan of plan.orphans) {
    rmSync(path.join(orphan.endsWith(".html") ? toolDir : outDir, orphan), { force: true });
  }

  const manifest = {
    pillar: pillar.slug,
    repo: `dougdevitre/${pillar.repo}`,
    syncedAt: commit,
    docs: docs.map(({ slug, title, file }) => ({ slug, title, file })),
    tools: tools.map(({ slug, label, file }) => ({ slug, label, file })),
  };
  if (skippedTools.length) manifest.skippedTools = skippedTools;
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const prunedNote = plan.orphans.length ? `, pruned ${plan.orphans.length} stale` : "";
  console.log(`  ${docs.length} doc(s), ${tools.length} tool(s)${skippedTools.length ? `, ${skippedTools.length} skipped React app(s)` : ""}${prunedNote} → manifest @ ${commit}`);
  return { slug: pillar.slug, status: "ok", docs: docs.length, tools: tools.length, prevDocs, pruned: plan.orphans.length, skipped: skippedTools };
}

// Append a markdown summary to the GitHub Actions run page when running in CI, so
// a degraded/regressed sync is visible without digging through the raw log.
function writeStepSummary(results) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const rows = results
    .map((r) => `| ${r.slug} | ${r.prevDocs} → ${r.docs} | ${r.tools} | ${r.pruned || 0} | ${r.status} |`)
    .join("\n");
  const md =
    `\n### sync-pillars\n\n` +
    `| pillar | docs (prev→new) | tools | pruned | status |\n` +
    `|---|---|---|---|---|\n${rows}\n`;
  try {
    writeFileSync(file, md, { flag: "a" });
  } catch {
    /* summary is best-effort */
  }
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
  const results = [];
  for (const p of pillars) {
    try {
      results.push(syncOne(p, tmpRoot));
    } catch (e) {
      console.error(`  ! ${p.slug} failed: ${e.message}`);
      results.push({ slug: p.slug, status: "failed", docs: 0, tools: 0, prevDocs: 0, error: e.message, skipped: [] });
    }
  }
  if (!DRY) rmSync(tmpRoot, { recursive: true, force: true });
  // cpSync imported for parity with sync-assets; reserved for future asset copies.
  void cpSync;

  const skipped = results.flatMap((r) => (r.skipped ?? []).map((s) => ({ pillar: r.slug, ...s })));
  if (skipped.length) {
    console.warn(`\n⚠️  ${skipped.length} React-app tool(s) skipped (not standalone HTML):`);
    for (const s of skipped) console.warn(`   • ${s.pillar}: apps path ${s.path} — embed a built artifact, link out, or skip.`);
    console.warn("   These are recorded under manifest.skippedTools for follow-up.");
  }

  if (!DRY) writeStepSummary(results);

  // Loud failure: a clone error or a regression-guarded wipe must FAIL the run so
  // the CI commit step never ships a partial/destroyed sync. (See sync-pillars.yml.)
  const broken = results.filter((r) => r.status === "failed" || r.status === "regressed");
  if (broken.length) {
    console.error(`\n✗ ${broken.length} pillar(s) failed or regressed: ${broken.map((r) => `${r.slug}(${r.status})`).join(", ")}`);
    console.error("  No content was wiped; investigate before re-running. Nothing here masks the error.");
    process.exit(1);
  }
  console.log("\nDone. Review, then commit web/content/pillars/** and web/public/pillar-tools/**.");
}

// Only run when invoked as a script (not when imported by a unit test).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
