// Machine-readable inventory of every data source in the app, grouped by retrieval
// kind. The /dashboard/data hub maps over this; docs/data-architecture.md is its
// prose twin. Add a row here whenever you add a CSV manifest, an API route, or a
// geo layer so the source shows up in the hub with consistent provenance.
import type { SourceKind } from "./resource";

export type SourceEntry = {
  id: string;
  label: string;
  kind: SourceKind;
  /** Who/what owns the upstream (a file path, a vendor, an agency). */
  owner: string;
  /** Route or import the hub uses to read it (a GET endpoint, or a committed manifest path). */
  endpoint?: string;
  manifest?: string;
  /** Env var(s) that gate a live API; absent ⇒ the source degrades to a notice/fallback. */
  enabledEnv?: string[];
  /** Caching note for the hub (ISR seconds, HTTP cache, or "build" for static manifests). */
  cache: string;
  /** Safe for the hub to live-ping (idempotent GET, no heavy side effects). Geo is always checkable. */
  checkable?: boolean;
  note?: string;
};

export const SOURCES: SourceEntry[] = [
  // ── CSV / static (build-time generators → committed JSON manifest → import) ──
  {
    id: "print-tracker",
    label: "Print production tracker",
    kind: "csv",
    owner: "candidate/letters/print-tracker.csv",
    manifest: "web/lib/printTracker.json",
    cache: "build (npm run print-tracker)",
    note: "Letter-sized print queue mapped to templates. Reference slice for the Resource pattern.",
  },
  {
    id: "print-renditions",
    label: "Walgreens print designs",
    kind: "csv",
    owner: "web/scripts/generate-print-renditions.mjs",
    manifest: "web/lib/printRenditions.json",
    cache: "build",
    note: "12 signature designs × 3 photo sizes; consumed by the public Print Studio.",
  },

  // ── Live APIs (server Route Handler → Resource; degrade on missing creds) ──
  {
    id: "walgreens",
    label: "Walgreens Native Photo",
    kind: "api",
    owner: "services.walgreens.com",
    endpoint: "/api/print/products",
    enabledEnv: ["WALGREENS_API_KEY", "WALGREENS_AFF_ID"],
    cache: "no-store",
    note: "Product catalog (on the Resource layer via loadApi) + store finder + order submit. Degrades to download-only when unset.",
  },
  {
    id: "census",
    label: "Census ACS (MO-02 counties)",
    kind: "api",
    owner: "api.census.gov",
    endpoint: "/api/research/census",
    enabledEnv: ["CENSUS_API_KEY"],
    cache: "public, max-age=3600",
    checkable: true, // idempotent GET that returns a Resource — safe to ping from the hub
    note: "Demographics; works at low volume without a key. On the Resource layer (no UI consumer yet).",
  },
  {
    id: "fec",
    label: "OpenFEC",
    kind: "api",
    owner: "api.open.fec.gov",
    endpoint: "/api/research/alignment",
    enabledEnv: ["FEC_API_KEY"],
    cache: "force-dynamic",
    checkable: true, // alignment is a param-free GET that returns a Resource (field analysis)
    note: "Candidate finance; DEMO_KEY fallback throttles quickly. Alignment read is on the Resource layer.",
  },
  {
    id: "child-act",
    label: "CHILD Act bills",
    kind: "api",
    owner: "Congress.gov (ingested)",
    endpoint: "/api/research/child-act",
    cache: "force-dynamic",
    checkable: true, // param-free GET on the Resource layer; degrades when the store is unset
    note: "Family-court-relevant bills from the ingested federal record. Degrades when the store isn't connected.",
  },
  {
    id: "congress",
    label: "Congress.gov",
    kind: "api",
    owner: "api.congress.gov",
    endpoint: "/api/research/ingest",
    enabledEnv: ["CONGRESS_GOV_API_KEY"],
    cache: "force-dynamic",
    note: "Member profiles, bills, votes; persisted to DynamoDB.",
  },
  {
    id: "wikipedia",
    label: "Wikipedia bio",
    kind: "api",
    owner: "en.wikipedia.org",
    endpoint: "/api/research/bio",
    cache: "force-dynamic",
    note: "Public; requires User-Agent. Best-effort, never blocks ingest.",
  },
  {
    id: "news",
    label: "Google News RSS",
    kind: "api",
    owner: "news.google.com",
    endpoint: "/api/research/news",
    cache: "force-dynamic",
    note: "Public RSS; relevance-filtered by candidate name.",
  },

  // ── Geo (ArcGIS FeatureServer → normalized GeoJSON + meta → maplibre) ──
  {
    id: "geo-precincts",
    label: "MO-02 precincts (turnout)",
    kind: "geo",
    owner: "ArcGIS — St. Louis County",
    endpoint: "/api/geo/precincts",
    cache: "ISR 86400",
    note: "2025 enacted map membership + Aug 2024 primary turnout; sample fallback.",
  },
  {
    id: "geo-jefferson",
    label: "Jefferson County precincts",
    kind: "geo",
    owner: "ArcGIS — Jefferson County",
    endpoint: "/api/geo/jefferson",
    cache: "ISR 86400",
    note: "88 precinct boundaries (no turnout).",
  },
  {
    id: "geo-pois",
    label: "Points of interest / polling",
    kind: "geo",
    owner: "ArcGIS + sample",
    endpoint: "/api/geo/pois",
    cache: "ISR 86400",
    note: "Live polling places clipped to MO-02 (turf point-in-polygon) + sample POIs.",
  },
  {
    id: "geo-extra-counties",
    label: "Rural counties (VTDs)",
    kind: "geo",
    owner: "Census TIGERweb",
    endpoint: "/api/geo/extra-counties",
    cache: "ISR 604800",
    note: "Washington, Crawford, Gasconade boundaries (Census 2020 VTDs).",
  },
];

export const SOURCES_BY_KIND: Record<SourceKind, SourceEntry[]> = {
  csv: SOURCES.filter((s) => s.kind === "csv"),
  api: SOURCES.filter((s) => s.kind === "api"),
  geo: SOURCES.filter((s) => s.kind === "geo"),
};

export const KIND_LABEL: Record<SourceKind, string> = {
  csv: "CSV & static manifests",
  api: "Live APIs",
  geo: "Geo layers",
};
