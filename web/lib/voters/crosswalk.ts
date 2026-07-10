// Precinct crosswalk — the join spine between the voter file's precinct labels,
// the ArcGIS map features (web/lib/precincts.ts `name`), and the Airtable Geo
// Hierarchy. Pure. Voter-file labels are county-clerk strings and will not be
// byte-identical to map codes; everything joins through normalizePrecinct, and
// anything that STILL doesn't match is reported (ingest manifest), never
// silently dropped — the coverageGeo honesty rule.

const lc = (s: string) => s.trim().toLowerCase();

/** Normalize a precinct label for matching: lowercase, punctuation → space,
 *  collapse runs, drop leading zeros in numeric tokens ("Ward 03" ≡ "ward 3"). */
export function normalizePrecinct(s: string): string {
  return lc(s)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b0+(\d)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** The sharding + aggregate key for a voter row: county and normalized precinct. */
export function precinctKey(county: string, precinctName: string): string {
  return `${normalizePrecinct(county)}#${normalizePrecinct(precinctName) || "unknown"}`;
}

export type CrosswalkResult = {
  matched: Map<string, string>; // normalized voter-file label → canonical map name
  misses: string[]; // voter-file labels with no map counterpart (report, don't drop)
  hitRate: number; // 0..1 over distinct labels
};

/**
 * Match distinct voter-file precinct labels against the map's known precinct
 * names. Exact normalized match first; then a containment pass (map codes are
 * often a prefix/suffix of the clerk label or vice versa) only when it's
 * UNAMBIGUOUS — one candidate. Anything else is a miss for a human to map.
 */
export function buildCrosswalk(voterLabels: string[], mapNames: string[]): CrosswalkResult {
  const canon = new Map<string, string>(); // normalized map name → original
  for (const n of mapNames) {
    const k = normalizePrecinct(n);
    if (k && !canon.has(k)) canon.set(k, n);
  }
  const matched = new Map<string, string>();
  const misses: string[] = [];
  const distinct = [...new Set(voterLabels.map(normalizePrecinct))].filter(Boolean);
  for (const label of distinct) {
    const exact = canon.get(label);
    if (exact) {
      matched.set(label, exact);
      continue;
    }
    const candidates = [...canon.entries()].filter(([k]) => k.includes(label) || label.includes(k));
    if (candidates.length === 1) matched.set(label, candidates[0][1]);
    else misses.push(label);
  }
  return {
    matched,
    misses: misses.sort(),
    hitRate: distinct.length ? matched.size / distinct.length : 0,
  };
}
