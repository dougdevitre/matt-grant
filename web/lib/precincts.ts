import { PRECINCT_SOURCE, NEWMAP_PRECINCTS } from "@/lib/geoSources";

// Single home for MO-02 precinct data. MEMBERSHIP = the 2025 enacted map
// (congress_1/"congress25" from the county's April 2026 layer). TURNOUT = the
// Aug 2024 primary (TOTAL_CHECKINS / RV_COUNT), joined by precinct code. If the
// new-map codes can't be fetched, we fall back to the old-map field so the app
// still renders (clearly flagged via `scope`).

export type PrecinctRow = {
  name: string;
  municipality: string;
  registered: number;
  turnout: number | null; // % (Aug 2024 primary)
  expected: number;
  gotv: number;
};

export type ScoredRow = PrecinctRow & {
  rank: number;
  cumPct: number;
  tier: "A" | "B" | "C";
  play: "Persuade" | "Persuade + GOTV" | "Mobilize";
};

export type Strategy = "votes" | "gotv";
export type Scope = "new-map" | "old-map-fallback";

const REVALIDATE = 86400;
const ARCGIS_PAGE = 2000;

// Walk an ArcGIS FeatureServer query to completion. A single request is bounded by
// the layer's server-side maxRecordCount (commonly 1000 even when we ask for more)
// and signals "there's more" via exceededTransferLimit, so we page by resultOffset
// until a short, non-exceeded page. Offset advances by the rows ACTUALLY returned,
// not the requested page size — a server cap below ARCGIS_PAGE would otherwise skip
// every record between what came back and the next requested offset. Exported for
// unit tests. `base` carries the query params minus the pagination controls.
export async function fetchArcgisPaged(url: string, base: Record<string, string>): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({ ...base, resultOffset: String(offset), resultRecordCount: String(ARCGIS_PAGE) });
    const res = await fetch(`${url}?${params}`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) break;
    const d = await res.json();
    const feats = (d.features ?? []) as Record<string, unknown>[];
    out.push(...feats);
    if (feats.length === 0) break;
    offset += feats.length; // advance by rows returned, NOT the requested page size
    const exceeded = d.exceededTransferLimit || d.properties?.exceededTransferLimit;
    if (feats.length < ARCGIS_PAGE && !exceeded) break;
    if (offset > 20000) break; // safety
  }
  return out;
}

// The authoritative "which precincts are in MO-02" set (2025 enacted map). Paginated:
// a single 2000-row request was silently truncated at the layer's server cap, dropping
// every precinct past it from both the map and the targeting rows.
async function fetchNewMapCodes(): Promise<Set<string> | null> {
  try {
    const feats = await fetchArcgisPaged(NEWMAP_PRECINCTS.url, {
      where: NEWMAP_PRECINCTS.where,
      outFields: "precinct",
      returnGeometry: "false",
      f: "json",
    });
    const codes = feats.map((f) => propsOf(f).precinct).filter(Boolean) as string[];
    return codes.length ? new Set(codes) : null;
  } catch {
    return null;
  }
}

// Paginated fetch of the Aug-2024 turnout layer (handles the layer's record cap).
async function fetchAug2024(geometry: boolean): Promise<Record<string, unknown>[]> {
  const base: Record<string, string> = {
    where: "1=1",
    outFields: "precinct,municipality,TOTAL_CHECKINS,RV_COUNT,congressional_district_20",
    returnGeometry: String(geometry),
    f: geometry ? "geojson" : "json",
  };
  if (geometry) {
    base.outSR = "4326";
    base.maxAllowableOffset = "0.0004";
    base.geometryPrecision = "5";
  }
  return fetchArcgisPaged(PRECINCT_SOURCE.url, base);
}

function propsOf(f: Record<string, unknown>): Record<string, unknown> {
  // json -> attributes; geojson -> properties
  return (f.attributes ?? f.properties ?? {}) as Record<string, unknown>;
}

function normalize(p: Record<string, unknown>): PrecinctRow {
  const registered = Number(p.RV_COUNT) || 0;
  const ci = p.TOTAL_CHECKINS == null ? null : Number(p.TOTAL_CHECKINS);
  const turnout = registered > 0 && ci != null ? Math.round((100 * ci) / registered) : null;
  const tFrac = turnout != null ? turnout / 100 : 0;
  return {
    name: String(p.precinct ?? "—"),
    municipality: String(p.municipality ?? "").trim(),
    registered,
    turnout,
    expected: Math.round(registered * tFrac),
    gotv: Math.round(registered * (1 - tFrac)),
  };
}

function inScope(p: Record<string, unknown>, codes: Set<string> | null): boolean {
  if (codes) return codes.has(String(p.precinct));
  return p.congressional_district_20 === "US Representative District 2"; // fallback
}

export type ScopedPrecincts = {
  live: boolean;
  scope: Scope;
  rows: PrecinctRow[];
  features: GeoJSON.Feature[];
};

export async function fetchScopedPrecincts(opts: { geometry: boolean }): Promise<ScopedPrecincts> {
  const codes = await fetchNewMapCodes();
  const scope: Scope = codes ? "new-map" : "old-map-fallback";
  const feats = await fetchAug2024(opts.geometry);
  if (!feats.length) return { live: false, scope, rows: [], features: [] };

  const scoped = feats.filter((f) => inScope(propsOf(f), codes));
  const rows = scoped.map((f) => normalize(propsOf(f)));
  const features: GeoJSON.Feature[] = opts.geometry
    ? scoped.map((f) => ({ type: "Feature", properties: normalize(propsOf(f)) as unknown as GeoJSON.GeoJsonProperties, geometry: (f as { geometry: GeoJSON.Geometry }).geometry }))
    : [];
  return { live: true, scope, rows, features };
}

// Back-compat helpers used by the routes/pages.
export async function fetchPrecinctRows(): Promise<{ live: boolean; scope: Scope; rows: PrecinctRow[] }> {
  const r = await fetchScopedPrecincts({ geometry: false });
  return { live: r.live, scope: r.scope, rows: r.rows };
}

export async function fetchCd2Geometry(): Promise<GeoJSON.FeatureCollection | null> {
  const r = await fetchScopedPrecincts({ geometry: true });
  return r.features.length ? { type: "FeatureCollection", features: r.features } : null;
}

export function scoreRows(rows: PrecinctRow[], strategy: Strategy): { scored: ScoredRow[]; medianTurnout: number; totals: { expected: number; registered: number } } {
  const valid = rows.filter((r) => r.turnout != null);
  const turnouts = valid.map((r) => r.turnout as number).sort((a, b) => a - b);
  const medianTurnout = turnouts.length ? turnouts[Math.floor(turnouts.length / 2)] : 0;

  const metric = (r: PrecinctRow) => (strategy === "votes" ? r.expected : r.gotv);
  const sorted = [...rows].sort((a, b) => metric(b) - metric(a));
  const total = sorted.reduce((s, r) => s + metric(r), 0) || 1;

  let cum = 0;
  const scored: ScoredRow[] = sorted.map((r, i) => {
    cum += metric(r);
    const cumPct = Math.round((cum / total) * 100);
    const tier: ScoredRow["tier"] = cumPct <= 40 ? "A" : cumPct <= 70 ? "B" : "C";
    const t = r.turnout ?? 0;
    const play: ScoredRow["play"] =
      t >= medianTurnout + 4 ? "Persuade" : t <= medianTurnout - 4 ? "Mobilize" : "Persuade + GOTV";
    return { ...r, rank: i + 1, cumPct, tier, play };
  });

  return {
    scored,
    medianTurnout,
    totals: { expected: rows.reduce((s, r) => s + r.expected, 0), registered: rows.reduce((s, r) => s + r.registered, 0) },
  };
}

/**
 * Stamp scoreRows output onto GeoJSON features (joined by the unique precinct
 * `name` already on each feature's properties), so the map's tier/GOTV modes read
 * the EXACT ranking the Targets page shows. Features with no scored match (e.g. a
 * name mismatch) pass through untouched — they paint as "unscored" neutrals, never
 * a wrong tier.
 */
export function attachScores(features: GeoJSON.Feature[], scored: ScoredRow[]): GeoJSON.Feature[] {
  const byName = new Map(scored.map((r) => [r.name, r]));
  return features.map((f) => {
    const name = (f.properties as { name?: unknown } | null)?.name;
    const s = name != null ? byName.get(String(name)) : undefined;
    if (!s) return f;
    return {
      ...f,
      properties: { ...f.properties, tier: s.tier, play: s.play, rank: s.rank, cumPct: s.cumPct },
    };
  });
}
