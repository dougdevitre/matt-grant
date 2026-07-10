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

// TURNOUT source: Aug 6 2024 PRIMARY — the low-turnout electorate Matt faces on
// Aug 4 2026. Real turnout = TOTAL_CHECKINS / RV_COUNT, joined by precinct code.
// (This layer's only congressional field is `congressional_district_20` = the OLD
// 2022 map, so we scope MEMBERSHIP via NEWMAP_PRECINCTS below, not this field.)
export const PRECINCT_SOURCE = {
  url: "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/August_2024_Precincts_view/FeatureServer/0/query",
  oldMapWhere: "congressional_district_20='US Representative District 2'",
  label: "St. Louis County — Aug 6 2024 primary",
};

// MEMBERSHIP source for the NEW 2025 ENACTED map. The county's April 2026
// precinct layer carries TWO congressional fields:
//   congressio  (alias "congress22") = old 2022 map
//   congress_1  (alias "congress25") = new 2025 map  ← authoritative for 2026
// We take the new-map MO-02 precinct codes from here and join turnout by code.
export const NEWMAP_PRECINCTS = {
  url: "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/April_7_2026_Precincts_Dashboard_view/FeatureServer/0/query",
  where: "congress_1='US Representative District 2'",
  label: "MO-02 (2025 enacted map)",
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

// Jefferson County precinct boundaries (added to MO-02 in the 2025 map — wholly
// in the district). 88 precincts; no turnout/congress fields, so boundary-only.
export const JEFFERSON = {
  url: "https://services1.arcgis.com/Ur3TPhgM56qvxaar/arcgis/rest/services/Voting_Precincts/FeatureServer/0/query",
  label: "Jefferson County (boundaries)",
};

// MO public schools — DESE's statewide point layer on the state GIS server
// (documented in candidate/data-and-map-plan.md; discovered July 10, 2026 via the
// MSDIS "MO Public Schools" listing). WIRED DEFENSIVELY: the endpoint's query
// interface and field names could not be pre-verified from the build sandbox
// (state-GIS domains are blocked there), so the pois route treats any fetch/parse
// mismatch as "no live data" and serves the curated sample instead — the schools
// layer only badges "live" when this feed actually returns parseable point
// features in production.
export const SCHOOLS = {
  url: "https://gis.mo.gov/arcgis/rest/services/DESE/Missouri_Public_Schools/MapServer/0/query",
  label: "MO public schools (DESE)",
};

// Washington / Crawford / Gasconade — added to MO-02 in the 2025 map but with no
// county ArcGIS feed. Use Census 2020 Voting Districts (TIGERweb) for boundaries.
export const CENSUS_VTD = {
  url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/58/query",
  counties: {
    "29221": "Washington",
    "29055": "Crawford",
    "29073": "Gasconade",
  } as Record<string, string>,
};

export type PoiFeature = {
  type: "Feature";
  properties: { name: string; category: string; note?: string; source?: string };
  geometry: { type: "Point"; coordinates: [number, number] };
};
