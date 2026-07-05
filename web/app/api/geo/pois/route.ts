import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { geoRoute } from "@/lib/data/geo";
import { ARCGIS, arcgisGeojsonUrl, type PoiFeature } from "@/lib/geoSources";
import { fetchCd2Geometry } from "@/lib/precincts";
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

export const GET = geoRoute({
  source: "St. Louis County polling (clipped) + sample POIs",
  // POIs always include the sample non-polling categories, so this fallback is
  // only used if the fetcher itself throws.
  fallback: { type: "FeatureCollection", features: [] },
  cacheControl: "public, s-maxage=86400, stale-while-revalidate=43200",
  fetcher: async () => {
    // Non-polling categories stay sample for now (schools/public/partners need
    // MSDIS/OSM joins — see candidate/data-and-map-plan.md).
    const nonPolling = sampleFeatures().filter((f) => f.properties.category !== "polling");

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
        live_layers: pollingLive ? ["polling"] : [],
        pollingCount: polling.length,
        pollingLive,
        districtFiltered,
        countyCount, // before clipping, for reference
        coverage: "St. Louis County portion of MO-02",
      },
    };
  },
});
