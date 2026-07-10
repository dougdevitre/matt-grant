// Client-side search index over whatever the field map is currently showing —
// no geocoder, no network, no new deps. MapExplorer already holds every layer's
// FeatureCollection; this flattens them into typed, rankable entries whose
// selection resolves to a camera fit (bounds) + optional precinct pulse.

import { bboxOfFeatureCollections, type Bounds } from "@/lib/viz/mapView";

export type SearchEntry = {
  label: string;
  sublabel?: string;
  kind: "municipality" | "precinct" | "polling place" | "school" | "public place" | "partner" | "event" | "county";
  bounds: Bounds;
  featureId?: string; // precinct name — lets the map pulse the column on arrival
};

// Field-ops entities outrank points of interest when scores tie.
const KIND_PRIORITY: Record<SearchEntry["kind"], number> = {
  municipality: 0,
  precinct: 1,
  "polling place": 2,
  event: 3,
  county: 4,
  school: 5,
  "public place": 5,
  partner: 5,
};

const POI_KIND: Record<string, SearchEntry["kind"]> = {
  polling: "polling place",
  schools: "school",
  public: "public place",
  partners: "partner",
};

type Layers = {
  precincts: GeoJSON.FeatureCollection;
  pois: GeoJSON.FeatureCollection;
  events: GeoJSON.FeatureCollection;
  jefferson: GeoJSON.FeatureCollection;
  extra: GeoJSON.FeatureCollection;
};

const boundsOf = (features: GeoJSON.Feature[]): Bounds | null =>
  bboxOfFeatureCollections([{ type: "FeatureCollection", features }]);

/** Flatten the map's current layers into search entries (municipalities are synthesized
 *  by grouping precincts; counties by grouping the boundary layers). */
export function buildSearchIndex(layers: Layers): SearchEntry[] {
  const out: SearchEntry[] = [];

  // Precincts + synthesized municipalities.
  const byMuni = new Map<string, GeoJSON.Feature[]>();
  for (const f of layers.precincts.features) {
    const p = (f.properties ?? {}) as { name?: string; municipality?: string };
    const b = boundsOf([f]);
    if (!b) continue;
    if (p.name) out.push({ label: String(p.name), sublabel: p.municipality || undefined, kind: "precinct", bounds: b, featureId: String(p.name) });
    const muni = (p.municipality ?? "").trim();
    if (muni) (byMuni.get(muni) ?? byMuni.set(muni, []).get(muni)!).push(f);
  }
  for (const [muni, feats] of byMuni) {
    const b = boundsOf(feats);
    if (b) out.push({ label: muni, sublabel: `${feats.length} precincts`, kind: "municipality", bounds: b });
  }

  // POIs (points pad to a real extent inside bboxOfFeatureCollections).
  for (const f of layers.pois.features) {
    const p = (f.properties ?? {}) as { name?: string; category?: string; note?: string };
    const b = boundsOf([f]);
    if (!b || !p.name) continue;
    out.push({ label: String(p.name), sublabel: p.note || undefined, kind: POI_KIND[p.category ?? ""] ?? "public place", bounds: b });
  }

  // Events (only geocoded ones reach the map layer).
  for (const f of layers.events.features) {
    const p = (f.properties ?? {}) as { title?: string; locationName?: string };
    const b = boundsOf([f]);
    if (!b || !p.title) continue;
    out.push({ label: String(p.title), sublabel: p.locationName || undefined, kind: "event", bounds: b });
  }

  // Counties — one entry per county across the boundary layers.
  const byCounty = new Map<string, GeoJSON.Feature[]>();
  for (const f of [...layers.jefferson.features, ...layers.extra.features]) {
    const county = ((f.properties ?? {}) as { county?: string }).county?.trim();
    if (county) (byCounty.get(county) ?? byCounty.set(county, []).get(county)!).push(f);
  }
  for (const [county, feats] of byCounty) {
    const b = boundsOf(feats);
    if (b) out.push({ label: `${county} County`, kind: "county", bounds: b });
  }

  return out;
}

/**
 * Rank entries for a query: word-prefix beats substring, then kind priority,
 * then shorter label (tighter match). Empty/whitespace queries return nothing.
 */
export function searchEntries(index: SearchEntry[], query: string, limit = 8): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { e: SearchEntry; score: number }[] = [];
  for (const e of index) {
    const label = e.label.toLowerCase();
    let score: number;
    if (label.startsWith(q)) score = 0;
    else if (label.split(/[\s\-–/(),]+/).some((w) => w.startsWith(q))) score = 1;
    else if (label.includes(q)) score = 2;
    else continue;
    scored.push({ e, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      KIND_PRIORITY[a.e.kind] - KIND_PRIORITY[b.e.kind] ||
      a.e.label.length - b.e.label.length ||
      a.e.label.localeCompare(b.e.label),
  );
  return scored.slice(0, limit).map((s) => s.e);
}
