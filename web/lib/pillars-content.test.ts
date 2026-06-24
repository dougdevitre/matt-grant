import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { validateManifest } from "./pillars-content";
import { pillarSlugs } from "./pillars";

const CONTENT_ROOT = path.join(process.cwd(), "content", "pillars");
const TOOLS_ROOT = path.join(process.cwd(), "public", "pillar-tools");

// Discover which pillars actually have a committed manifest (pre-content, only
// README.md is present, so there may be none — that's fine, the per-manifest tests
// just don't run yet). This guards against a corrupt/inconsistent commit landing.
function committedManifests(): { slug: string; dir: string }[] {
  if (!existsSync(CONTENT_ROOT)) return [];
  return readdirSync(CONTENT_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(CONTENT_ROOT, d.name, "manifest.json")))
    .map((d) => ({ slug: d.name, dir: path.join(CONTENT_ROOT, d.name) }));
}

describe("validateManifest (unit)", () => {
  const good = {
    pillar: "education",
    repo: "dougdevitre/access-to-education",
    syncedAt: "abc1234",
    docs: [{ slug: "iep", title: "IEP", file: "iep.md" }],
    tools: [{ slug: "calc", label: "Calc", file: "calc.html" }],
  };

  it("accepts a well-formed manifest", () => {
    expect(validateManifest(good, "education")).toEqual([]);
  });

  it("flags a wrong shape, missing fields, and a dir mismatch", () => {
    expect(validateManifest(null)).toHaveLength(1);
    expect(validateManifest({ ...good, docs: "nope" })).toContain("docs must be an array");
    expect(validateManifest({ ...good, tools: [{ slug: "x" }] }).length).toBeGreaterThan(0);
    expect(validateManifest(good, "housing")).toContain('pillar "education" != dir "housing"');
  });
});

describe("committed pillar manifests are valid and self-consistent", () => {
  const manifests = committedManifests();

  it("every manifest dir is a known pillar slug", () => {
    for (const { slug } of manifests) expect(pillarSlugs).toContain(slug);
  });

  it.each(manifests)("$slug: schema valid + referenced files exist", ({ slug, dir }) => {
    const raw = readFileSync(path.join(dir, "manifest.json"), "utf8");
    const parsed = JSON.parse(raw); // throws loudly on corrupt JSON
    expect(validateManifest(parsed, slug)).toEqual([]);

    for (const doc of parsed.docs) {
      expect(existsSync(path.join(dir, doc.file)), `${slug}/${doc.file} missing`).toBe(true);
    }
    for (const tool of parsed.tools) {
      expect(existsSync(path.join(TOOLS_ROOT, slug, tool.file)), `pillar-tools/${slug}/${tool.file} missing`).toBe(true);
    }
  });
});
