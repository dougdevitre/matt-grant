import { readFile } from "node:fs/promises";
import path from "node:path";
import { googleFont } from "@/lib/googleFont";

// Brand fonts for server-side image rendering (next/og ImageResponse). We self-host
// Fraunces 700 (headline) + Public Sans 600 (labels) as committed .woff2 and read
// them from disk, so a Google Fonts outage can't silently downgrade the typeface —
// or the FEC disclaimer's look — on any generated card. googleFont() stays only as a
// last-ditch fallback if the local read ever fails. See web/lib/fonts/README.md.

export type LoadedFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" };

// WOFF v1 (not woff2 — satori/opentype can't decode the woff2 signature).
const FILES = {
  fraunces: "fraunces-700.woff",
  publicSans: "public-sans-600.woff",
} as const;

// Read once per process — these files never change at runtime. They live under
// public/ (not lib/) so Next's standalone output always ships them: `public/` is
// copied wholesale, whereas a readFile of a dynamic lib/ path isn't file-traced.
const cache = new Map<string, Promise<Buffer | null>>();
function readLocal(file: string): Promise<Buffer | null> {
  let p = cache.get(file);
  if (!p) {
    p = readFile(path.join(process.cwd(), "public", "fonts", file)).catch(() => null);
    cache.set(file, p);
  }
  return p;
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function loadFace(
  file: string,
  name: string,
  weight: 600 | 700,
  fallbackText: string,
): Promise<LoadedFont | null> {
  const local = await readLocal(file);
  if (local) return { name, data: toArrayBuffer(local), weight, style: "normal" };
  // Local read failed (unexpected) — fall back to the network fetch so we never
  // render blank. This is strictly better than the old always-network behavior.
  const remote = await googleFont(name, weight, fallbackText);
  return remote ? { name, data: remote, weight, style: "normal" } : null;
}

/**
 * The `fonts` array for `ImageResponse`. `headlineText`/`sansText` are only used to
 * subset the network fallback; the local files are full Latin and ignore them.
 * Returns whatever loaded (filtered) — an empty array lets next/og use its default,
 * exactly as before, so callers spread it defensively: `...(fonts.length ? { fonts } : {})`.
 */
export async function brandFonts(headlineText: string, sansText: string): Promise<LoadedFont[]> {
  const [fraunces, publicSans] = await Promise.all([
    loadFace(FILES.fraunces, "Fraunces", 700, headlineText),
    loadFace(FILES.publicSans, "Public Sans", 600, sansText),
  ]);
  return [fraunces, publicSans].filter((f): f is LoadedFont => f !== null);
}
