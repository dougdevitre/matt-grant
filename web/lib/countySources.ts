// MO-02 county coverage registry — 2025 ENACTED map (in effect for the 2026 primary).
//
// Verified June 2026: Missouri's Trump-backed mid-decade map was signed 2025-09-28
// and upheld by the Missouri Supreme Court 2026-03-24 (4-3); local election
// officials are using it for the Aug 4 2026 primary. A citizen ballot initiative
// could still suspend it. Under this map the NEW MO-02 = southern St. Louis County
// suburbs + Gasconade, Crawford, Jefferson, Washington. St. Charles & Warren moved
// OUT to MO-03. (Franklin is NOT in the new MO-02 — earlier inclusion was an error.)
//
// Caveat baked in below: our live St. Louis County precinct turnout is from the
// 2024 election, tagged to the OLD (2022) map's MO-02 = WESTERN St. Louis County.
// The new MO-02 is the SOUTHERN suburbs, so that footprint needs re-derivation.

export type Resolution = "precinct-turnout" | "precinct+polling" | "precinct-boundary" | "county-level";
export type Status = "live" | "live-old-map" | "available" | "needs-source";

export type CountySource = {
  county: string;
  role: string;
  resolution: Resolution;
  status: Status;
  endpoints?: { label: string; url: string }[];
  note: string;
};

export const MO02_COUNTIES: CountySource[] = [
  {
    county: "St. Louis County (part)",
    role: "Anchor — largest share of MO-02 votes",
    resolution: "precinct-turnout",
    status: "live-old-map",
    endpoints: [
      { label: "Precinct turnout (Aug 2024)", url: "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/August_2024_Precincts_view/FeatureServer" },
      { label: "Polling places (Apr 2026)", url: "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/4_7_2026_Polling_Places/FeatureServer" },
    ],
    note: "Live, but tagged to the OLD map (western county). New MO-02 = southern suburbs — re-derive against a 2026 precinct layer.",
  },
  {
    county: "Jefferson County",
    role: "New in 2025 map (incl. Arnold)",
    resolution: "precinct-boundary",
    status: "available",
    endpoints: [
      { label: "Voting Precincts (boundaries)", url: "https://services1.arcgis.com/Ur3TPhgM56qvxaar/arcgis/rest/services/Voting_Precincts/FeatureServer" },
    ],
    note: "ArcGIS precinct polygons (no turnout fields). Turnout = SOS county-level.",
  },
  {
    county: "Washington County",
    role: "New in 2025 map",
    resolution: "county-level",
    status: "needs-source",
    note: "No county ArcGIS feed found. Use Census VTD boundaries + SOS county turnout/registration.",
  },
  {
    county: "Crawford County",
    role: "New in 2025 map",
    resolution: "county-level",
    status: "needs-source",
    note: "No county ArcGIS feed found. Use Census VTD boundaries + SOS county turnout/registration.",
  },
  {
    county: "Gasconade County",
    role: "New in 2025 map",
    resolution: "county-level",
    status: "needs-source",
    note: "No county ArcGIS feed found. Use Census VTD boundaries + SOS county turnout/registration.",
  },
];

export const RESOLUTION_LABEL: Record<Resolution, string> = {
  "precinct-turnout": "Precinct turnout",
  "precinct+polling": "Precincts + polling",
  "precinct-boundary": "Precinct boundaries",
  "county-level": "County-level only",
};

export const STATUS_LABEL: Record<Status, string> = {
  live: "Live in app",
  "live-old-map": "Live — OLD map footprint",
  available: "Feed available — wire next",
  "needs-source": "Needs Census/SOS source",
};
