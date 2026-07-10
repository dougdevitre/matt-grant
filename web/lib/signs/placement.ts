// Sign-placement scoring + allocation — the pure core behind candidate/sign-placement-plan.md.
//
// Mirrors the repo's "data-as-code" pattern: lib/precincts.ts `scoreRows` (cumulative-tier ranking)
// and lib/volunteers/coverage.ts `buildCoverage` (group + span-cap allocation). No DB / network — CSV
// parsing (lib/data/csv.ts `parseCsv`), CSV output (lib/contacts/import.ts `toCsv`), any map geometry,
// and the dashboard page are thin adapters around these pure functions, so the load-bearing logic is
// unit-tested in isolation.
//
// The `in_district`, `buffer_verified`, and `property_permission` gates are read straight off the
// input CSV columns (the schema in the plan's §7 carries them), so the core needs no ArcGIS/turf call;
// a page may pre-stamp `in_district` via turf point-in-polygon before handing rows here.

// site = a polling / early-vote / library location (voter contact); corridor/residential = impressions.
export type PlacementType = "corridor" | "residential" | "site";
export type PlacementTier = "A" | "B" | "C";

export type PlacementInput = {
  name: string;
  lat?: number;
  lng?: number;
  type: PlacementType;
  precinct?: string;
  captainId?: string;
  // hard-filter gates (from the CSV booleans)
  inDistrict: boolean;
  bufferVerified: boolean;
  propertyPermission: boolean;
  assignedVolunteer?: string; // servicing volunteer (Phase 2's "every location has a host")
  notes?: string; // operational notes — carried through to the output, never destroyed
  // scoring factors (all 0..1 unless noted; missing → a NEUTRAL default, never a zeroing one)
  aadtNorm?: number; // corridor/residential: normalized traffic 0..1
  aadtRaw?: number; // raw MoDOT AADT count (e.g. 45000) — normalized across the set by normalizeTraffic
  propensity?: number; // R-primary propensity of the precinct 0..1 (label proxy upstream)
  visibility?: number; // sightline quality 0..1
  serviceability?: number; // volunteer maintainability 0.5..1 (0.5 floor when un-hosted)
  voterContactValue?: number; // site: worth of reaching deciding voters 0..1
  daysActive?: number; // site: 14 early-vote, 1 Election-Day-only
};

export type DroppedPlacement = { row: PlacementInput; reasons: string[] };
export type ScoredPlacement = PlacementInput & { score: number; rank: number; tier: PlacementTier };

export type CaptainInput = { id: string; name?: string; signInventory?: number };
export type CaptainPacket = {
  captainId: string;
  name?: string;
  count: number;
  signInventory?: number;
  overCapacity: boolean; // count exceeds the captain's on-hand inventory
  overSpan: boolean; // count exceeds the span-of-control cap
  placements: ScoredPlacement[];
};
export type Allocation = {
  packets: CaptainPacket[];
  needsHost: ScoredPlacement[]; // no captain assigned — cannot be serviced yet
  totals: { placed: number; assigned: number; needsHost: number };
};

// Span-of-control default, mirroring lib/volunteers/coverage.ts SPAN_MAX (10) — a captain servicing
// more than this many sign locations is flagged for a co-captain / hand-off.
export const SIGN_SPAN_MAX = 20;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const num = (n: number | undefined, dflt: number) => (typeof n === "number" && Number.isFinite(n) ? n : dflt);
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const R_EARTH_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters between two lat/lng points (haversine). Pure; no util existed. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return round4(2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(h))));
}

/**
 * Normalize raw MoDOT AADT counts into aadtNorm across the candidate set (min-max), for rows that
 * carry a raw `aadt` but no pre-normalized `aadt_norm`. Without this, a raw 45,000 and a raw 3,000
 * would both clamp to 1.0 at scoring — erasing the model's primary corridor differentiator. Rows
 * with an explicit aadtNorm are untouched; a degenerate set (all equal raw values) maps to 1.0.
 */
export function normalizeTraffic(rows: PlacementInput[]): PlacementInput[] {
  const raws = rows.filter((r) => r.aadtNorm == null && typeof r.aadtRaw === "number").map((r) => r.aadtRaw as number);
  if (raws.length === 0) return rows;
  const min = Math.min(...raws);
  const max = Math.max(...raws);
  return rows.map((r) => {
    if (r.aadtNorm != null || typeof r.aadtRaw !== "number") return r;
    const norm = max === min ? 1 : (r.aadtRaw - min) / (max - min);
    return { ...r, aadtNorm: round4(norm) };
  });
}

/**
 * Hard filters (run first): a candidate is scored only if it is in-district, has property permission,
 * and its polling-place buffer is verified. Anything failing is dropped with reasons (the audit trail),
 * never silently scored. Mirrors the "filter before score" discipline in the plan's §8.0.
 */
export function hardFilter(rows: PlacementInput[]): { kept: PlacementInput[]; dropped: DroppedPlacement[] } {
  const kept: PlacementInput[] = [];
  const dropped: DroppedPlacement[] = [];
  for (const r of rows) {
    const reasons: string[] = [];
    if (!r.inDistrict) reasons.push("out-of-district");
    if (!r.propertyPermission) reasons.push("no property permission");
    if (!r.bufferVerified) reasons.push("buffer not verified");
    if (reasons.length) dropped.push({ row: r, reasons });
    else kept.push(r);
  }
  return { kept, dropped };
}

/**
 * Per-row score in 0..1 (both families kept on the same scale so they read comparably; allocation still
 * ranks WITHIN type per the plan). Sites earn their rank from days_active (14-day early-vote >> 1-day
 * poll), which is dominant but never zeroes the other factors; corridor/residential multiply
 * traffic × propensity × visibility × serviceability.
 */
export function placementScore(r: PlacementInput): number {
  const vis = clamp(num(r.visibility, 0.5), 0, 1);
  const svc = clamp(num(r.serviceability, 0.5), 0.5, 1);
  if (r.type === "site") {
    const vcv = clamp(num(r.voterContactValue, 0.5), 0, 1);
    const daysNorm = clamp(num(r.daysActive, 1) / 14, 0, 1); // 14→1.0, 1→~0.07
    return round4(vcv * (0.4 + 0.6 * daysNorm) * vis * svc); // days dominant, never a zero multiplier
  }
  // Missing traffic data defaults NEUTRAL (0.5), not 0 — a spec-schema CSV that carries no
  // traffic columns must still produce a meaningful ranking instead of all-zero scores.
  const aadt = clamp(num(r.aadtNorm, 0.5), 0, 1);
  const prop = clamp(num(r.propensity, 0.5), 0, 1);
  return round4(aadt * prop * vis * svc);
}

/**
 * Score + rank + tier every kept row WITHIN its family (site vs. corridor/residential), so the two
 * scales aren't compared head-to-head. Tier is a rank-percentile priority band within each family
 * (top 40% by rank → A, next 30% → B, rest → C) — the useful reading for "fund A first" allocation,
 * not the Pareto/cumulative-value tiering (which mis-bands a single dominant early-vote site). Ties
 * break by higher serviceability, then higher propensity (maintainable/likely beats flashy) —
 * matching the plan's §8.4.
 */
export function scorePlacements(rows: PlacementInput[]): ScoredPlacement[] {
  const families: PlacementType[][] = [["site"], ["corridor", "residential"]];
  const out: ScoredPlacement[] = [];
  for (const fam of families) {
    const inFam = rows.filter((r) => fam.includes(r.type));
    const withScore = inFam.map((r) => ({ r, score: placementScore(r) }));
    withScore.sort(
      (a, b) =>
        b.score - a.score ||
        num(b.r.serviceability, 0.5) - num(a.r.serviceability, 0.5) ||
        num(b.r.propensity, 0.5) - num(a.r.propensity, 0.5),
    );
    const n = withScore.length || 1;
    withScore.forEach((x, i) => {
      const pct = ((i + 1) / n) * 100;
      const tier: PlacementTier = pct <= 40 ? "A" : pct <= 70 ? "B" : "C";
      out.push({ ...x.r, score: x.score, rank: i + 1, tier });
    });
  }
  return out;
}

/**
 * Group scored placements onto their captains and flag load problems, mirroring `buildCoverage`:
 * `overCapacity` when a captain is assigned more locations than their on-hand `signInventory`,
 * `overSpan` when they exceed `spanMax` locations to service. Placements with no captain land in
 * `needsHost` (they can't be maintained — the plan's serviceability discipline).
 */
export function allocateToCaptains(
  scored: ScoredPlacement[],
  captains: CaptainInput[],
  opts: { spanMax?: number } = {},
): Allocation {
  const spanMax = opts.spanMax ?? SIGN_SPAN_MAX;
  const byId = new Map<string, CaptainInput>(captains.map((c) => [c.id, c]));
  const grouped = new Map<string, ScoredPlacement[]>();
  const needsHost: ScoredPlacement[] = [];

  for (const p of scored) {
    const cid = p.captainId && byId.has(p.captainId) ? p.captainId : "";
    if (!cid) {
      needsHost.push(p);
      continue;
    }
    (grouped.get(cid) ?? grouped.set(cid, []).get(cid)!).push(p);
  }

  const packets: CaptainPacket[] = [...grouped].map(([captainId, placements]) => {
    const c = byId.get(captainId);
    const count = placements.length;
    return {
      captainId,
      name: c?.name,
      count,
      signInventory: c?.signInventory,
      overCapacity: typeof c?.signInventory === "number" ? count > c.signInventory : false,
      overSpan: count > spanMax,
      placements: [...placements].sort((a, b) => a.rank - b.rank),
    };
  });
  packets.sort((a, b) => b.count - a.count);

  const assigned = packets.reduce((s, p) => s + p.count, 0);
  return {
    packets,
    needsHost,
    totals: { placed: scored.length, assigned, needsHost: needsHost.length },
  };
}

// ── CSV adapters (pure; used by the export route / a page) ────────────────────────────────────────
const bool = (v: string | undefined) => /^(true|1|yes|y)$/i.test((v ?? "").trim());
const opt = (v: string | undefined): number | undefined => {
  const n = Number((v ?? "").trim());
  return v != null && v !== "" && Number.isFinite(n) ? n : undefined;
};
const asType = (v: string | undefined): PlacementType => {
  const s = (v ?? "").toLowerCase();
  if (s.includes("site") || s.includes("poll") || s.includes("library") || s.includes("early")) return "site";
  if (s.includes("resid")) return "residential";
  return "corridor";
};

/** Map a parsed `polling_sites.csv` / candidate-location row (from `parseCsv`) to a PlacementInput.
 *  `aadt` is the RAW MoDOT count (normalized later by `normalizeTraffic`); `aadt_norm` is 0..1. */
export function rowToPlacement(row: Record<string, string>): PlacementInput {
  return {
    name: row.name ?? "",
    lat: opt(row.lat),
    lng: opt(row.lng),
    type: asType(row.site_type ?? row.type),
    precinct: row.precinct || undefined,
    captainId: row.captain_id || undefined,
    assignedVolunteer: row.assigned_volunteer || undefined,
    notes: row.notes || undefined,
    inDistrict: bool(row.in_district),
    bufferVerified: bool(row.buffer_verified),
    propertyPermission: bool(row.property_permission),
    aadtNorm: opt(row.aadt_norm),
    aadtRaw: opt(row.aadt),
    propensity: opt(row.propensity),
    visibility: opt(row.visibility),
    serviceability: opt(row.serviceability),
    voterContactValue: opt(row.voter_contact_value),
    daysActive: opt(row.days_active),
  };
}

// Matches the plan's §7 placement_output.csv, with `tier` (A/B/C priority band) in place of the
// draft's leftover `phase` letter — the plan documents this mapping.
export const PLACEMENT_OUTPUT_HEADERS = [
  "rank",
  "name",
  "lat",
  "lng",
  "type",
  "tier",
  "captain_id",
  "assigned_volunteer",
  "score",
  "precinct",
  "aadt",
  "notes",
] as const;

// Excel executes a leading = + - @ in a cell as a formula — neutralize donor/operator-supplied
// text (name/notes) so a crafted location name can't become =HYPERLINK(...) in the download.
const deFormula = (s: string | undefined): string | undefined =>
  s && /^[=+\-@]/.test(s) ? `'${s}` : s;

const outRow = (p: ScoredPlacement, rank: number | "", noteOverride?: string): (string | number | null | undefined)[] => [
  rank,
  deFormula(p.name),
  p.lat,
  p.lng,
  p.type,
  p.tier,
  p.captainId,
  p.assignedVolunteer,
  p.score,
  p.precinct,
  p.aadtRaw,
  deFormula(noteOverride ?? p.notes),
];

/**
 * Rows for `placement_output.csv` (feed to `toCsv(PLACEMENT_OUTPUT_HEADERS, …)`).
 * Deploy order per the plan's §8.4: ALL sites first (early-vote sites are funded off the top of N),
 * then corridor/residential — each family in its own rank order. Rank is the sequential deploy
 * order, NOT a cross-family score comparison (the two families score on different bases).
 * Hard-filtered `dropped` rows are appended at the bottom with a blank rank and a
 * "DROPPED: <reasons>" note — the audit trail the plan mandates, visible right in the download.
 */
export function placementRows(
  scored: ScoredPlacement[],
  dropped: DroppedPlacement[] = [],
): (string | number | null | undefined)[][] {
  const byFamilyRank = (fam: PlacementType[]) =>
    scored.filter((p) => fam.includes(p.type)).sort((a, b) => a.rank - b.rank);
  const ordered = [...byFamilyRank(["site"]), ...byFamilyRank(["corridor", "residential"])];
  const rows = ordered.map((p, i) => outRow(p, i + 1));
  for (const d of dropped) {
    const r = d.row;
    rows.push([
      "", // no rank — not deployable
      deFormula(r.name),
      r.lat,
      r.lng,
      r.type,
      "", // no tier
      r.captainId,
      r.assignedVolunteer,
      "", // no score
      r.precinct,
      r.aadtRaw,
      deFormula(`DROPPED: ${d.reasons.join("; ")}${r.notes ? ` | ${r.notes}` : ""}`),
    ]);
  }
  return rows;
}
