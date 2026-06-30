// Geo precision for captain auto-match. PURE (type-only import of Region, so it's
// testable without the server-only guard). Resolves a volunteer to the region they
// sit in — ZIP first (most precise), then city name — and walks UP the Geo
// Hierarchy's Parent Area chain so a captain who covers a county also covers a
// volunteer who only gave their city/ZIP. Without this, matching was loose string
// containment, so a "St. Louis County" captain never matched a "Kirkwood" volunteer.
import type { Region } from "./regions";

const lc = (s: string) => s.trim().toLowerCase();

export type GeoIndex = {
  byName: Map<string, Region>; // lowercased Area Name → region
  byId: Map<string, Region>; // Airtable record id → region
  byZip: Map<string, Region>; // ZIP → region (first wins)
};

export function buildGeoIndex(regions: Region[]): GeoIndex {
  const byName = new Map<string, Region>();
  const byId = new Map<string, Region>();
  const byZip = new Map<string, Region>();
  for (const r of regions) {
    if (r.name) byName.set(lc(r.name), r);
    if (r.id) byId.set(r.id, r);
    for (const z of r.zips ?? []) if (!byZip.has(z)) byZip.set(z, r);
  }
  return { byName, byId, byZip };
}

// Parent Area may be a name or one/more linked record ids (comma-joined); resolve
// against ids first, then names.
function parentTokens(region: Region): string[] {
  return region.parent ? region.parent.split(",").map((s) => s.trim()).filter(Boolean) : [];
}
function resolveToken(token: string, idx: GeoIndex): Region | undefined {
  return idx.byId.get(token) ?? idx.byName.get(lc(token));
}

export type Placeable = { zip?: string | null; city?: string | null };

/** The most specific region a volunteer sits in: ZIP match first, else city name. */
export function resolveRegion(v: Placeable, idx: GeoIndex): Region | undefined {
  const zip = (v.zip ?? "").trim();
  if (zip && idx.byZip.has(zip)) return idx.byZip.get(zip);
  const city = (v.city ?? "").trim();
  if (city && idx.byName.has(lc(city))) return idx.byName.get(lc(city));
  return undefined;
}

/**
 * Lowercased names of every region that COVERS the volunteer — the region they sit
 * in plus all of its ancestors up the parent chain. Empty when the volunteer can't
 * be placed. Cycle-safe (a malformed parent loop can't hang it).
 */
export function coverageNamesFor(v: Placeable, idx: GeoIndex): Set<string> {
  const out = new Set<string>();
  let cur = resolveRegion(v, idx);
  while (cur && cur.name && !out.has(lc(cur.name))) {
    out.add(lc(cur.name));
    const tokens = parentTokens(cur);
    cur = tokens.length ? resolveToken(tokens[0], idx) : undefined;
  }
  return out;
}
