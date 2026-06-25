// Server-only by construction: it imports node:fs, so it can never be bundled
// into a client component. (We avoid the optional `server-only` marker package to
// keep the dependency set unchanged.)
import { readFileSync } from "node:fs";
import path from "node:path";
import type { PillarTool } from "./pillars";

// Server-only loader for content synced from each access-to-* repo by
// scripts/sync-pillars.mjs. The synced output is COMMITTED into the repo under
// web/content/pillars/<slug>/, so the Amplify build renders it without any
// build-time network/git. When a pillar hasn't been synced yet, every accessor
// returns empty/undefined and the pages fall back to the catalog blurb + a
// link out to the source repo — so the site always builds and renders.

export type PillarDoc = {
  slug: string; // url segment, e.g. "iep-navigation"
  title: string;
  file: string; // relative to the pillar dir, e.g. "iep-navigation.md"
};

export type PillarManifest = {
  pillar: string;
  repo: string;
  syncedAt: string; // ISO date or source commit — stamped by the sync script
  docs: PillarDoc[];
  tools: PillarTool[];
  // React/SPA "tools" the sync couldn't import as standalone HTML — recorded by
  // scripts/sync-pillars.mjs for per-repo follow-up (build, link out, or skip).
  // Informational only; the app doesn't render these.
  skippedTools?: { name: string; path: string }[];
};

const CONTENT_ROOT = path.join(process.cwd(), "content", "pillars");

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null; // absent or unreadable — not synced yet
  }
}

export function getManifest(pillarSlug: string): PillarManifest | null {
  return readJson<PillarManifest>(path.join(CONTENT_ROOT, pillarSlug, "manifest.json"));
}

// Structural validation for a committed manifest.json. Returns the list of problems
// (empty = valid). Used by the manifest test to turn a corrupt/half-written manifest
// into a loud CI failure instead of a silent "being prepared" fallback at runtime.
export function validateManifest(value: unknown, expectedSlug?: string): string[] {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null) return ["manifest is not an object"];
  const m = value as Record<string, unknown>;
  if (typeof m.pillar !== "string") errors.push("pillar must be a string");
  else if (expectedSlug && m.pillar !== expectedSlug) errors.push(`pillar "${m.pillar}" != dir "${expectedSlug}"`);
  if (typeof m.repo !== "string") errors.push("repo must be a string");
  if (typeof m.syncedAt !== "string") errors.push("syncedAt must be a string");

  const checkEntries = (key: "docs" | "tools", labelField: "title" | "label") => {
    const arr = m[key];
    if (!Array.isArray(arr)) return errors.push(`${key} must be an array`), undefined;
    arr.forEach((e, i) => {
      const o = e as Record<string, unknown>;
      if (typeof o?.slug !== "string") errors.push(`${key}[${i}].slug must be a string`);
      if (typeof o?.file !== "string") errors.push(`${key}[${i}].file must be a string`);
      if (typeof o?.[labelField] !== "string") errors.push(`${key}[${i}].${labelField} must be a string`);
    });
  };
  checkEntries("docs", "title");
  checkEntries("tools", "label");
  return errors;
}

export function getDoc(pillarSlug: string, docSlug: string): { doc: PillarDoc; markdown: string } | null {
  const manifest = getManifest(pillarSlug);
  const doc = manifest?.docs.find((d) => d.slug === docSlug);
  if (!doc) return null;
  try {
    const markdown = readFileSync(path.join(CONTENT_ROOT, pillarSlug, doc.file), "utf8");
    return { doc, markdown };
  } catch {
    return null;
  }
}
