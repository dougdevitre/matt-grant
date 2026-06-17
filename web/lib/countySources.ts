// MO-02 county coverage registry — 2025 proposed map.
// MO-02 = the west/south part of St. Louis County + five added counties.
// Precinct-level TURNOUT is only published by St. Louis County; the rural
// counties offer (at best) precinct boundaries + polling, with turnout available
// only at the county level from the Secretary of State. This registry keeps that
// honest and gives the exact endpoints to wire next.

export type Resolution = "precinct-turnout" | "precinct+polling" | "precinct-boundary" | "county-level";
export type Status = "live" | "available" | "needs-source";

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
    status: "live",
    endpoints: [
      { label: "Precinct turnout (Aug 2024)", url: "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/August_2024_Precincts_view/FeatureServer" },
      { label: "Polling places (Apr 2026)", url: "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/4_7_2026_Polling_Places/FeatureServer" },
    ],
    note: "Wired live: 3D turnout columns + district-clipped polling.",
  },
  {
    county: "Jefferson County",
    role: "Added in 2025 map (incl. Arnold)",
    resolution: "precinct-boundary",
    status: "available",
    endpoints: [
      { label: "Voting Precincts (boundaries)", url: "https://services1.arcgis.com/Ur3TPhgM56qvxaar/arcgis/rest/services/Voting_Precincts/FeatureServer" },
    ],
    note: "ArcGIS precinct polygons exist (no turnout fields). Turnout = SOS county-level.",
  },
  {
    county: "Franklin County",
    role: "Added in 2025 map",
    resolution: "precinct+polling",
    status: "available",
    endpoints: [
      { label: "Precincts (Voter2022)", url: "https://services7.arcgis.com/HM4C7tGF5KT34U6h/arcgis/rest/services/Voter2022/FeatureServer" },
      { label: "Polling places", url: "https://services7.arcgis.com/HM4C7tGF5KT34U6h/arcgis/rest/services/FranklinPollingPlaces/FeatureServer" },
    ],
    note: "ArcGIS precincts + rich polling feed (no turnout). Turnout = SOS county-level.",
  },
  {
    county: "Washington County",
    role: "Added in 2025 map",
    resolution: "county-level",
    status: "needs-source",
    note: "No county ArcGIS feed found. Use Census VTD boundaries + SOS county turnout/registration.",
  },
  {
    county: "Crawford County",
    role: "Added in 2025 map",
    resolution: "county-level",
    status: "needs-source",
    note: "No county ArcGIS feed found. Use Census VTD boundaries + SOS county turnout/registration.",
  },
  {
    county: "Gasconade County",
    role: "Added in 2025 map",
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
  available: "Feed available — wire next",
  "needs-source": "Needs Census/SOS source",
};
