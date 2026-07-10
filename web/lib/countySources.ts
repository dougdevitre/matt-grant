// MO-02 county coverage registry — 2025 ENACTED map (in effect for the 2026 primary).
//
// Verified June 2026 against the county GIS fields: Missouri's Trump-backed
// mid-decade map was signed 2025-09-28 and upheld by the MO Supreme Court
// 2026-03-24 (4-3); officials are using it for the Aug 4 2026 primary (a ballot
// initiative could still suspend it). The county precinct layer carries both
// congress22 (old) and congress25 (new); we scope on congress25.
//
// Within St. Louis County the new MO-02 stays predominantly WESTERN/CENTRAL
// (630 precincts; 564 unchanged, 66 added, 48 dropped vs the 2022 map) — it did
// NOT move to the southern suburbs. The district's southward shift is the ADDED
// rural counties: Franklin, Jefferson, Washington, Crawford, Gasconade. St. Charles
// & Warren moved OUT to MO-03. (Franklin's membership was disputed — an earlier GIS
// check excluded it — but the official voter file codes 78,635 Franklin voters into
// 2025-map CD-2, verified 2026-07-10; see candidate/voter-file-plan.md §5.)

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
    role: "Anchor — largest share of MO-02 votes (western/central suburbs)",
    resolution: "precinct-turnout",
    status: "live",
    endpoints: [
      { label: "New-map membership (congress25, Apr 2026)", url: "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/April_7_2026_Precincts_Dashboard_view/FeatureServer" },
      { label: "Turnout (Aug 2024 primary)", url: "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/August_2024_Precincts_view/FeatureServer" },
      { label: "Polling places (Apr 2026)", url: "https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/4_7_2026_Polling_Places/FeatureServer" },
    ],
    note: "Scoped to the 2025 map (congress25); turnout = Aug 2024 primary joined by precinct (506/630 precincts matched).",
  },
  {
    county: "Jefferson County",
    role: "New in 2025 map — wholly in MO-02 (incl. Arnold)",
    resolution: "precinct-boundary",
    status: "live",
    endpoints: [
      { label: "Voting Precincts (88, live)", url: "https://services1.arcgis.com/Ur3TPhgM56qvxaar/arcgis/rest/services/Voting_Precincts/FeatureServer" },
    ],
    note: "Live on the map as a boundary layer (88 precincts). No turnout/congress fields — turnout is SOS county-level.",
  },
  {
    county: "Franklin County",
    role: "Second-largest county in MO-02 (78,635 registered voters, 13.6% — per the official voter file, 2026-07-10)",
    resolution: "precinct-boundary",
    status: "live",
    endpoints: [
      { label: "Census 2020 VTDs (TIGERweb)", url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/58" },
    ],
    note: "Added 2026-07-10 after the voter-file census superseded the earlier GIS-based exclusion. Census VTD boundaries (no turnout feed); turnout = SOS county-level.",
  },
  {
    county: "Washington County",
    role: "New in 2025 map",
    resolution: "precinct-boundary",
    status: "live",
    endpoints: [
      { label: "Census 2020 VTDs (TIGERweb)", url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/58" },
    ],
    note: "Live on the map as Census VTD boundaries (no turnout feed). Turnout = SOS county-level.",
  },
  {
    county: "Crawford County",
    role: "New in 2025 map",
    resolution: "precinct-boundary",
    status: "live",
    endpoints: [
      { label: "Census 2020 VTDs (TIGERweb)", url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/58" },
    ],
    note: "Live on the map as Census VTD boundaries (no turnout feed). Turnout = SOS county-level.",
  },
  {
    county: "Gasconade County",
    role: "New in 2025 map",
    resolution: "precinct-boundary",
    status: "live",
    endpoints: [
      { label: "Census 2020 VTDs (TIGERweb)", url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/58" },
    ],
    note: "Live on the map as Census VTD boundaries (no turnout feed). Turnout = SOS county-level.",
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
