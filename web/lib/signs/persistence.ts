// Pure helpers for persisted sign placements — client-safe (no AWS SDK import),
// so SignPlacementTool ("use client") can share the record type and dedupe logic
// with the server store without pulling DynamoDB into the browser bundle.
//
// Scores/rank/tier are NEVER stored — they are derived by lib/signs/placement.ts
// from these input rows, exactly as for pasted rows.

import type { PlacementInput, PlacementType } from "@/lib/signs/placement";

export type SignPlacementRecord = PlacementInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string; // staff email that last touched the row
};

const NAME_MAX = 160;
const NOTES_MAX = 500;
const TYPES: PlacementType[] = ["corridor", "residential", "site"];

const lc = (s: string) => s.trim().toLowerCase();

/**
 * Identity for save-time dedupe: same name at (approximately) the same spot is the
 * same placement. Coordinates round to 5 decimals (~1 m); rows without coordinates
 * key on name alone. Used by BOTH the client's "unsaved rows" filter and the server
 * action's re-check, so a double-click or re-pasted CSV can never double-insert.
 */
export function dedupeKey(p: Pick<PlacementInput, "name" | "lat" | "lng">): string {
  const coord = (n: number | undefined) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(5) : "");
  return `${lc(p.name)}|${coord(p.lat)}|${coord(p.lng)}`;
}

/** Incoming rows minus anything already saved (by dedupeKey). First occurrence wins
 *  within `incoming` too, so a paste containing its own duplicates saves once. */
export function filterNew(existing: Pick<PlacementInput, "name" | "lat" | "lng">[], incoming: PlacementInput[]): PlacementInput[] {
  const seen = new Set(existing.map(dedupeKey));
  const out: PlacementInput[] = [];
  for (const row of incoming) {
    const k = dedupeKey(row);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
};
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/**
 * Validate one untrusted row (the save action receives client-serialized JSON) into
 * a PlacementInput, or null when it isn't one. Deliberately strict on the values
 * that matter: booleans must be literally true to count (a truthy string never
 * flips a compliance gate), numbers must be finite, type must be a known family.
 */
export function sanitizePlacement(raw: unknown): PlacementInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, NAME_MAX);
  if (!name) return null;
  const type = TYPES.includes(r.type as PlacementType) ? (r.type as PlacementType) : "corridor";
  return {
    name,
    lat: num(r.lat),
    lng: num(r.lng),
    type,
    precinct: str(r.precinct, NAME_MAX),
    captainId: str(r.captainId, NAME_MAX),
    assignedVolunteer: str(r.assignedVolunteer, NAME_MAX),
    notes: str(r.notes, NOTES_MAX),
    inDistrict: r.inDistrict === true,
    bufferVerified: r.bufferVerified === true,
    propertyPermission: r.propertyPermission === true,
    aadtNorm: num(r.aadtNorm),
    aadtRaw: num(r.aadtRaw),
    propensity: num(r.propensity),
    visibility: num(r.visibility),
    serviceability: num(r.serviceability),
    voterContactValue: num(r.voterContactValue),
    daysActive: num(r.daysActive),
  };
}

/** Defensive mapping from a raw DynamoDB item to a record (mirrors events' rawToRow):
 *  the stored payload is re-sanitized so a hand-edited or legacy item can't smuggle
 *  a truthy-but-not-true gate into scoring; missing bookkeeping fields get blanks. */
export function rawToRecord(it: Record<string, unknown>): SignPlacementRecord | null {
  const input = sanitizePlacement(it);
  if (!input) return null;
  const id = typeof it.SK === "string" && it.SK ? it.SK : typeof it.id === "string" ? it.id : "";
  if (!id) return null;
  return {
    ...input,
    id,
    createdAt: typeof it.createdAt === "string" ? it.createdAt : "",
    updatedAt: typeof it.updatedAt === "string" ? it.updatedAt : "",
    updatedBy: typeof it.updatedBy === "string" ? it.updatedBy : "",
  };
}
