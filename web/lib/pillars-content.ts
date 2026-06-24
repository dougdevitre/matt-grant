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
