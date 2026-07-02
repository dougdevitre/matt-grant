// Machine-readable inventory of every data source in the app, grouped by retrieval
// kind. The /dashboard/data hub maps over this; docs/data-architecture.md is its
// prose twin. Add a row here whenever you add a CSV manifest, an API route, or a
// geo layer so the source shows up in the hub with consistent provenance.
import type { SourceKind } from "./resource";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";

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
  /** CSV: the command that regenerates the committed manifest from its source. */
  regen?: string;
  /** Free-form fix shown when this source is degraded/errored (e.g. "Run /api/research/ingest"). */
  remedy?: string;
  note?: string;
};

// Excluded stores (deliberately NOT surfaced here): donor + finance records live
// in DynamoDB only (single-table), carry supporter/donor PII, and are gated by
// viewDonorDetail / viewFinanceTotals — they are managed in the Donors/Finance
// dashboards, not the data hub, and are never mirrored to Airtable. See
// docs/data-architecture.md ("Excluded sources"). If you add a hub row for them,
// you are changing that policy on purpose.
export const SOURCES: SourceEntry[] = [
  // ── CSV / static (build-time generators → committed JSON manifest → import) ──
  {
    id: "print-tracker",
    label: "Print production tracker",
    kind: "csv",
    owner: "candidate/letters/print-tracker.csv",
    manifest: "web/lib/printTracker.json",
    cache: "build (npm run print-tracker)",
    regen: "npm run print-tracker",
    note: "Letter-sized print queue mapped to templates. Reference slice for the Resource pattern.",
  },
  {
    id: "print-renditions",
    label: "Walgreens print designs",
    kind: "csv",
    owner: "web/scripts/generate-print-renditions.mjs",
    manifest: "web/lib/printRenditions.json",
    cache: "build",
    regen: "node scripts/generate-print-renditions.mjs",
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
    remedy: "Run /api/research/ingest with the CRON_SECRET bearer to populate the store",
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
  {
    id: "openstates",
    label: "Open States (MO General Assembly)",
    kind: "api",
    owner: "v3.openstates.org",
    endpoint: "/api/research/ingest",
    enabledEnv: ["OPENSTATES_API_KEY"],
    cache: "force-dynamic",
    // No standalone idempotent GET, so not `checkable`; ingested via the field
    // pipeline. Only runs for candidates who held MO state office.
    note: "State-legislative record (sponsored bills) for candidates with a MO state-office history; ingested via /api/research/ingest. Free X-API-KEY.",
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
  {
    id: "geo-events",
    label: "Campaign events",
    kind: "geo",
    owner: "DynamoDB (geocoded events)",
    endpoint: "/api/geo/events",
    cache: "no-store",
    note: "Located campaign appearances plotted on the map (published; drafts for event managers). Auth-gated.",
  },

  // ── Airtable (workspace PAT → REST GET; one row per governed base) ──
  // The full base/table map + CRUD governance live in lib/airtable/{registry,
  // governance-manifest}.ts; these rows make each base visible + reachability-
  // checkable in the hub. The `registry.test.ts` drift guard asserts every
  // AIRTABLE_BASES key has a matching `airtable-<key>` row here.
  {
    id: "airtable-masterDb",
    label: "Master DB — Influential Voters (Airtable)",
    kind: "airtable",
    owner: `Airtable — ${AIRTABLE_BASES.masterDb.id}`,
    endpoint: "/api/airtable/health/masterDb",
    enabledEnv: ["AIRTABLE_API_KEY"],
    cache: "no-store",
    checkable: true,
    remedy: "Set AIRTABLE_API_KEY (SSM /matt-grant/AIRTABLE_API_KEY) and grant the workspace PAT access to this base",
    note: "Influencer / influential-voter outreach pipeline (source of truth in Airtable).",
  },
  {
    id: "airtable-volunteer",
    label: "Volunteer Engagement (Airtable)",
    kind: "airtable",
    owner: `Airtable — ${AIRTABLE_BASES.volunteer.id}`,
    endpoint: "/api/airtable/health/volunteer",
    enabledEnv: ["AIRTABLE_API_KEY"],
    cache: "no-store",
    checkable: true,
    remedy: "Set AIRTABLE_API_KEY (SSM /matt-grant/AIRTABLE_API_KEY) and grant the workspace PAT access to this base",
    note: "Volunteer roster mirror + reference tables (roles, skills, turf, contact lists, geo) + events read-model.",
  },
  {
    id: "airtable-socialMedia",
    label: "Social Media calendar (Airtable)",
    kind: "airtable",
    owner: `Airtable — ${AIRTABLE_BASES.socialMedia.id}`,
    endpoint: "/api/airtable/health/socialMedia",
    enabledEnv: ["AIRTABLE_API_KEY"],
    cache: "no-store",
    checkable: true,
    remedy: "Set AIRTABLE_API_KEY (SSM /matt-grant/AIRTABLE_API_KEY) and grant the workspace PAT access to this base",
    note: "Content calendar — posts, channels, pillars, campaigns, assets (source of truth in Airtable).",
  },
  {
    id: "airtable-issues",
    label: "Issue submissions (Airtable)",
    kind: "airtable",
    owner: `Airtable — ${AIRTABLE_BASES.issues.id}`,
    endpoint: "/api/airtable/health/issues",
    enabledEnv: ["AIRTABLE_API_KEY"],
    cache: "no-store",
    checkable: true,
    remedy: "Set AIRTABLE_API_KEY (SSM /matt-grant/AIRTABLE_API_KEY) and grant the workspace PAT access to this base",
    note: "Moderated community issue submissions from /issues (source of truth in Airtable).",
  },
  {
    id: "airtable-budget",
    label: "Budget Builder (Airtable)",
    kind: "airtable",
    owner: `Airtable — ${AIRTABLE_BASES.budget.id}`,
    endpoint: "/api/airtable/health/budget",
    enabledEnv: ["AIRTABLE_API_KEY"],
    cache: "no-store",
    checkable: true,
    remedy: "Set AIRTABLE_API_KEY (SSM /matt-grant/AIRTABLE_API_KEY) and grant the workspace PAT access to this base",
    note: "Planning catalog + expense-approval pipeline (source of truth in Airtable).",
  },
];

export const SOURCES_BY_KIND: Record<SourceKind, SourceEntry[]> = {
  csv: SOURCES.filter((s) => s.kind === "csv"),
  api: SOURCES.filter((s) => s.kind === "api"),
  geo: SOURCES.filter((s) => s.kind === "geo"),
  airtable: SOURCES.filter((s) => s.kind === "airtable"),
};

export const KIND_LABEL: Record<SourceKind, string> = {
  csv: "CSV & static manifests",
  api: "Live APIs",
  geo: "Geo layers",
  airtable: "Airtable bases",
};
