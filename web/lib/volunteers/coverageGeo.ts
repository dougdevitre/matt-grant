// Region → geometry bridge for the coverage page — pure and client-safe. Takes
// the coverage report's rows (Airtable Geo Hierarchy region names + gap/covered/
// overlap flags) and the map's existing geometry layers, and returns features
// stamped with coverage status for a fill layer. HONESTY RULES: a feature is
// claimed by at most one region (precinct beats municipality beats county, so
// nested levels never double-paint), and a region that matches no geometry is
// returned in `unmatched` — listed visibly, never guessed at.

export type CoverageStatus = "gap" | "covered" | "overlap";

// Serializable subset of the coverage report a server page can pass to the map.
export type CoverageMapRow = {
  name: string; // Geo Hierarchy "Area Name"
  level: string; // free-text "Geo Level" (display only — matching never trusts it)
  status: CoverageStatus;
  captains: string; // display label, e.g. "Ann (4) · Bo (2)" or "Unassigned"
  teamSize: number;
};

export type CoverageGeoLayers = {
  stl: GeoJSON.FeatureCollection | null; // /api/geo/precincts — props: name, municipality
  jefferson: GeoJSON.FeatureCollection | null; // /api/geo/jefferson — props: Precinct, county
  extra: GeoJSON.FeatureCollection | null; // /api/geo/extra-counties — props: NAME, county
};

/**
 * Normalize a place name for joining Airtable region names to feed spellings:
 * lowercase, periods dropped, whitespace collapsed, "saint" → "st", and a
 * trailing " county" stripped ("St. Louis County" ≡ "st louis" ≡ "Saint Louis").
 */
export function normalizeRegionName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\bsaint\b/g, "st")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ county$/, "");
}

const prop = (f: GeoJSON.Feature, key: string): string => {
  const v = (f.properties ?? {})[key];
  return typeof v === "string" ? v : v == null ? "" : String(v);
};

const push = (map: Map<string, GeoJSON.Feature[]>, key: string, f: GeoJSON.Feature) => {
  const k = normalizeRegionName(key);
  if (!k) return;
  const list = map.get(k) ?? [];
  list.push(f);
  map.set(k, list);
};

// St. Louis County has no whole-county polygon in any feed; the STL precinct
// layer is already clipped to the MO-02 portion, so that IS its best geometry —
// labeled honestly as the portion, never as the whole county.
const STL_COUNTY = normalizeRegionName("St. Louis County");
export const STL_PORTION_NOTE = "MO-02 portion";

export type CoverageGeoResult = {
  features: GeoJSON.Feature[]; // stamped: regionName/level/coverage/captains/teamSize(/portion)
  matched: CoverageMapRow[];
  unmatched: CoverageMapRow[];
};

/**
 * Join coverage rows to geometry. Three precedence passes — precinct, then
 * municipality (STL precincts grouped by `municipality`), then county
 * (jefferson + extra grouped by `county`, plus the STL-portion special case).
 * Each feature can be claimed once; input features are never mutated.
 */
export function matchRegionFeatures(rows: CoverageMapRow[], layers: CoverageGeoLayers): CoverageGeoResult {
  const stl = layers.stl?.features ?? [];
  const jefferson = layers.jefferson?.features ?? [];
  const extra = layers.extra?.features ?? [];

  // Indexes, all keyed by normalized name.
  const byPrecinct = new Map<string, GeoJSON.Feature[]>();
  const byMuni = new Map<string, GeoJSON.Feature[]>();
  const byCounty = new Map<string, GeoJSON.Feature[]>();
  for (const f of stl) {
    push(byPrecinct, prop(f, "name"), f);
    push(byMuni, prop(f, "municipality"), f);
  }
  for (const f of jefferson) {
    push(byPrecinct, prop(f, "Precinct"), f);
    push(byCounty, prop(f, "county"), f);
  }
  for (const f of extra) {
    push(byPrecinct, prop(f, "NAME"), f);
    push(byCounty, prop(f, "county"), f);
  }

  const claimed = new Set<GeoJSON.Feature>();
  const out: GeoJSON.Feature[] = [];
  const matchedRows = new Set<CoverageMapRow>();

  const claim = (row: CoverageMapRow, feats: GeoJSON.Feature[] | undefined, portion?: string): boolean => {
    const free = (feats ?? []).filter((f) => !claimed.has(f));
    if (!free.length) return false;
    for (const f of free) {
      claimed.add(f);
      out.push({
        ...f,
        properties: {
          ...f.properties,
          regionName: row.name,
          level: row.level,
          coverage: row.status,
          captains: row.captains,
          teamSize: row.teamSize,
          ...(portion ? { portion } : {}),
        },
      });
    }
    matchedRows.add(row);
    return true;
  };

  // Pass 1 — precincts (most specific wins the feature).
  for (const row of rows) claim(row, byPrecinct.get(normalizeRegionName(row.name)));
  // Pass 2 — municipalities/townships (grouped STL precincts).
  for (const row of rows) {
    if (!matchedRows.has(row)) claim(row, byMuni.get(normalizeRegionName(row.name)));
  }
  // Pass 3 — counties, incl. the St. Louis (MO-02 portion) special case.
  for (const row of rows) {
    if (matchedRows.has(row)) continue;
    const key = normalizeRegionName(row.name);
    if (key === STL_COUNTY) claim(row, stl, STL_PORTION_NOTE);
    else claim(row, byCounty.get(key));
  }

  return {
    features: out,
    matched: rows.filter((r) => matchedRows.has(r)),
    unmatched: rows.filter((r) => !matchedRows.has(r)),
  };
}
