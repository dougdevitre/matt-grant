// Live geodata source endpoints. These are public ArcGIS FeatureServers; we
// fetch them server-side (see app/api/geo) to avoid CORS and to cache.
//
// Polling places = the official St. Louis County Election Board layer
// ("April 7, 2026 General Municipal Election - Polling Places", 196 records).
// Swap or add layers here; the map and proxy pick them up automatically.

export const ARCGIS = {
  polling2026:
    "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/4_7_2026_Polling_Places/FeatureServer/0/query",
  // Nov 5 2024 GENERAL precincts (high-turnout electorate). Alt layer.
  precinctsGeneral2024:
    "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/November2024_Dashboard_Precincts_view/FeatureServer/0/query",
};

// Precinct layer that drives the map's turnout columns. We use the Aug 6 2024
// PRIMARY — the same low-turnout, high-intensity electorate Matt faces on the
// Aug 4 2026 primary ballot. Real turnout = TOTAL_CHECKINS / RV_COUNT.
// Note: this layer's congressional field is named `congressional_district_20`.
export const PRECINCT_SOURCE = {
  url: "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/August_2024_Precincts_view/FeatureServer/0/query",
  where: "congressional_district_20='US Representative District 2'",
  label: "St. Louis County — Aug 6 2024 primary",
};

export function arcgisGeojsonUrl(base: string): string {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  });
  return `${base}?${params.toString()}`;
}

export type PoiFeature = {
  type: "Feature";
  properties: { name: string; category: string; note?: string; source?: string };
  geometry: { type: "Point"; coordinates: [number, number] };
};
