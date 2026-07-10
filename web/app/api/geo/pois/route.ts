import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { geoRoute } from "@/lib/data/geo";
import { ARCGIS, SCHOOLS, arcgisGeojsonUrl, type PoiFeature } from "@/lib/geoSources";
import { fetchCd2Geometry } from "@/lib/precincts";
import { districtClipPolygons, pointInAnyPolygon } from "@/lib/geo/districtClip";
import { normalizeSchoolFeature } from "@/lib/geo/schoolsFeed";
import { POIS } from "@/lib/mapData";

// Cache the upstream pull for a day; polling locations rarely change mid-cycle.
export const revalidate = 86400;

function sampleFeatures(): PoiFeature[] {
  return POIS.map((p) => ({
    type: "Feature",
    properties: { name: p.name, category: p.category, note: p.note, source: "sample" },
    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
  }));
}

async function livePolling(): Promise<PoiFeature[] | null> {
  try {
    const res = await fetch(arcgisGeojsonUrl(ARCGIS.polling2026), {
      next: { revalidate },
      headers: { accept: "application/geo+json,application/json" },
    });
    if (!res.ok) return null;
    const fc = (await res.json()) as GeoJSON.FeatureCollection;
    if (!fc?.features?.length) return null;
    return fc.features
      .filter((f) => f.geometry?.type === "Point")
      .map((f) => {
        const p = (f.properties ?? {}) as Record<string, unknown>;
        return {
          type: "Feature",
          properties: {
            name: String(p.name ?? "Polling place"),
            category: "polling",
            note: [p.address, p.zipcode].filter(Boolean).join(", ") || undefined,
            source: "live",
          },
          geometry: { type: "Point", coordinates: (f.geometry as GeoJSON.Point).coordinates as [number, number] },
        };
      });
  } catch {
    return null;
  }
}

// DESE statewide public-school points — wired defensively (see lib/geoSources
// SCHOOLS): the endpoint couldn't be pre-verified from the build sandbox, so any
// fetch/parse mismatch returns null and the route keeps the curated sample.
// normalizeSchoolFeature drops every feature it can't confidently read, so a
// schema mismatch degrades to "no live data" — never to mislabeled pins.
async function liveSchools(): Promise<PoiFeature[] | null> {
  try {
    // Hard timeout: this route prerenders at build time (ISR), and Node fetch
    // never times out on its own — a hung gis.mo.gov would hang the BUILD
    // (exactly what took out the axe CI job). Abort → null → sample fallback.
    const res = await fetch(arcgisGeojsonUrl(SCHOOLS.url), {
      next: { revalidate },
      headers: { accept: "application/geo+json,application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const fc = (await res.json()) as GeoJSON.FeatureCollection;
    if (!fc?.features?.length) return null;
    const schools = fc.features.map(normalizeSchoolFeature).filter((f): f is PoiFeature => f !== null);
    if (schools.length === 0) return null; // schema mismatch → treat as no live data

    // The feed is STATEWIDE — it must clip to MO-02 (all counties, not just the
    // STL portion). No clip polygons → cannot clip → no live data (never serve
    // ~2,000 out-of-district schools).
    const polys = await districtClipPolygons();
    if (polys.length === 0) return null;
    const clipped = schools.filter((f) => pointInAnyPolygon(polys, f.geometry.coordinates));
    return clipped.length > 0 ? clipped : null;
  } catch {
    return null;
  }
}

export const GET = geoRoute({
  source: "St. Louis County polling + DESE schools (clipped) + sample POIs",
  // POIs always include the sample non-polling categories, so this fallback is
  // only used if the fetcher itself throws.
  fallback: { type: "FeatureCollection", features: [] },
  cacheControl: "public, s-maxage=86400, stale-while-revalidate=43200",
  fetcher: async () => {
    // Public places / partners stay sample (OSM joins deferred — see
    // candidate/data-and-map-plan.md); schools go live when the DESE feed parses.
    const nonLiveCategories = sampleFeatures().filter(
      (f) => f.properties.category !== "polling" && f.properties.category !== "schools",
    );

    const schoolsLiveFeatures = await liveSchools();
    const schools = schoolsLiveFeatures ?? sampleFeatures().filter((f) => f.properties.category === "schools");
    const schoolsLive = !!schoolsLiveFeatures;
    const nonPolling = [...nonLiveCategories, ...schools];

    const live = await livePolling();
    let polling = live ?? sampleFeatures().filter((f) => f.properties.category === "polling");

    // The county polling layer has no district field, so clip it to the MO-02
    // precinct polygons (St. Louis County portion). Without this it would show
    // MO-01/MO-03 sites too.
    let districtFiltered = false;
    let pollingLive = !!live;
    const countyCount = polling.length;
    if (live) {
      const geo = await fetchCd2Geometry();
      if (geo) {
        const polys = geo.features.filter(
          (f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon",
        );
        polling = polling.filter((f) =>
          polys.some((poly) =>
            booleanPointInPolygon(f.geometry.coordinates, poly as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>),
          ),
        );
        districtFiltered = true;
      } else {
        // The county polling layer has NO district field, so without the MO-02
        // geometry we can't clip it. Serving it unclipped would plot MO-01/MO-03
        // polling sites on the MO-02 map — fall back to the curated in-district
        // sample instead of leaking neighboring districts.
        polling = sampleFeatures().filter((f) => f.properties.category === "polling");
        pollingLive = false;
      }
    }

    return {
      fc: { type: "FeatureCollection", features: [...nonPolling, ...polling] },
      meta: {
        live_layers: [...(pollingLive ? ["polling"] : []), ...(schoolsLive ? ["schools"] : [])],
        pollingCount: polling.length,
        pollingLive,
        schoolsLive,
        schoolsCount: schools.length,
        districtFiltered,
        countyCount, // before clipping, for reference
        coverage: schoolsLive
          ? "Polling: St. Louis County portion of MO-02 · Schools: full MO-02"
          : "St. Louis County portion of MO-02",
      },
    };
  },
});
