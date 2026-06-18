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

async function fetchNewMapCodes(): Promise<Set<string> | null> {
  const params = new URLSearchParams({
    where: NEWMAP_PRECINCTS.where,
    outFields: "precinct",
    returnGeometry: "false",
    resultRecordCount: "2000",
    f: "json",
  });
  try {
    const res = await fetch(`${NEWMAP_PRECINCTS.url}?${params}`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return null;
    const d = (await res.json()) as { features?: { attributes: { precinct?: string } }[] };
    const codes = (d.features ?? []).map((f) => f.attributes?.precinct).filter(Boolean) as string[];
    return codes.length ? new Set(codes) : null;
  } catch {
    return null;
  }
}

// Paginated fetch of the Aug-2024 layer (handles the layer's record cap).
async function fetchAug2024(geometry: boolean): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const page = 2000;
  for (let offset = 0; ; offset += page) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "precinct,municipality,TOTAL_CHECKINS,RV_COUNT,congressional_district_20",
      returnGeometry: String(geometry),
      resultOffset: String(offset),
      resultRecordCount: String(page),
      f: geometry ? "geojson" : "json",
    });
    if (geometry) {
      params.set("outSR", "4326");
      params.set("maxAllowableOffset", "0.0004");
      params.set("geometryPrecision", "5");
    }
    const res = await fetch(`${PRECINCT_SOURCE.url}?${params}`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) break;
    const d = await res.json();
    const feats = (d.features ?? []) as Record<string, unknown>[];
    out.push(...feats);
    const exceeded = d.exceededTransferLimit || d.properties?.exceededTransferLimit;
    if (feats.length < page && !exceeded) break;
    if (feats.length === 0) break;
    if (offset > 20000) break; // safety
  }
  return out;
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
