// Live geodata source endpoints. These are public ArcGIS FeatureServers; we
// fetch them server-side (see app/api/geo) to avoid CORS and to cache.
//
// Polling places = the official St. Louis County Election Board layer
// ("April 7, 2026 General Municipal Election - Polling Places", 196 records).
// Swap or add layers here; the map and proxy pick them up automatically.

export const ARCGIS = {
  polling2026:
    "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/4_7_2026_Polling_Places/FeatureServer/0/query",
  // Nov 5 2024 general-election precincts with check-ins + registered voters
  // (real turnout = TOTAL_CHECKINS / RV_COUNT). 1,200 precincts countywide.
  precincts2024:
    "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/November2024_Dashboard_Precincts_view/FeatureServer/0/query",
};

// MO-02 filter value as stored in the county layer's congressional_district field.
export const CD2_WHERE = "congressional_district='US Representative District 2'";

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
