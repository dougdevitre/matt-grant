// Walk-turf cutting for canvass packets (voter-file-plan.md Phase 4, following
// workflows/voter-targeting.md: 40-60 targeted DOORS per 3-hour shift, sorted
// by street for walking order). Pure and client-safe — the explorer cuts turfs
// in the browser from an already-fetched precinct shard.
//
// The canvass-ID scale is defined HERE, once, so the printed key, the CSV
// column, and Phase 5's write-back can't drift. Operational convention:
// 1 = Strong Grant · 2 = Lean Grant · 3 = Undecided · 4 = Lean other · 5 = Strong other.
import type { StoredVoter } from "./storeTypes";

export const CANVASS_ID_KEY =
  "Canvass ID: 1 Strong Grant · 2 Lean Grant · 3 Undecided · 4 Lean other · 5 Strong other";

/** One door: every registered voter at the same address + unit. */
export type Household = {
  address: string;
  unit?: string;
  city: string;
  zip: string;
  street: string; // normalized street part, for sorting/grouping
  houseNum: number | null;
  voters: StoredVoter[];
};

export type WalkTurf = {
  index: number; // 1-based
  doors: number;
  voters: number;
  streets: string[]; // distinct, in walking order
  households: Household[];
  captain: { id: string; name: string } | null;
};

/** "1024 N Elm St" → { houseNum: 1024, street: "N ELM ST" }; no leading number → null. */
export function parseStreet(address: string): { houseNum: number | null; street: string } {
  const norm = address.trim().replace(/\s+/g, " ").toUpperCase();
  const m = /^(\d+)\s+(.*)$/.exec(norm);
  if (m) return { houseNum: Number(m[1]), street: m[2] || norm };
  return { houseNum: null, street: norm };
}

/** Group voters into households (address + unit + zip) and street-sort them. */
export function buildHouseholds(voters: StoredVoter[]): Household[] {
  const byDoor = new Map<string, Household>();
  for (const v of voters) {
    const key = `${v.address.trim().toLowerCase()}|${(v.unit ?? "").trim().toLowerCase()}|${v.zip}`;
    let h = byDoor.get(key);
    if (!h) {
      const { houseNum, street } = parseStreet(v.address);
      h = { address: v.address, unit: v.unit, city: v.city, zip: v.zip, street, houseNum, voters: [] };
      byDoor.set(key, h);
    }
    h.voters.push(v);
  }
  const hhs = [...byDoor.values()];
  for (const h of hhs) h.voters.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  // Walking order: street name, then house number (numberless addresses last on
  // their street), then the raw address as a stable tiebreak.
  hhs.sort(
    (a, b) =>
      a.street.localeCompare(b.street) ||
      (a.houseNum ?? Number.MAX_SAFE_INTEGER) - (b.houseNum ?? Number.MAX_SAFE_INTEGER) ||
      a.address.localeCompare(b.address) ||
      (a.unit ?? "").localeCompare(b.unit ?? ""),
  );
  return hhs;
}

// The targeting doc's shift size is 40-60 doors; we aim for the middle so cuts
// stay inside the band whenever the total allows. A precinct that can't split
// evenly into the band gets the nearest honest cut (e.g. 75 doors → 2 × ~38)
// rather than a fake in-band number.
const TARGET_DOORS = 50;

/** Cut a precinct's voters into street-contiguous walk turfs of ~40-60 doors. */
export function cutTurfs(voters: StoredVoter[]): WalkTurf[] {
  const hhs = buildHouseholds(voters);
  if (hhs.length === 0) return [];
  const nTurfs = Math.max(1, Math.round(hhs.length / TARGET_DOORS));
  const size = Math.ceil(hhs.length / nTurfs);
  const turfs: WalkTurf[] = [];
  for (let i = 0; i < nTurfs; i++) {
    const households = hhs.slice(i * size, (i + 1) * size);
    if (households.length === 0) break;
    turfs.push({
      index: i + 1,
      doors: households.length,
      voters: households.reduce((s, h) => s + h.voters.length, 0),
      streets: [...new Set(households.map((h) => h.street))],
      households,
      captain: null,
    });
  }
  return turfs;
}

/** Round-robin turfs across the active captain roster; [] captains → all unassigned. */
export function allocateTurfs(turfs: WalkTurf[], captains: { id: string; name: string }[]): WalkTurf[] {
  if (!captains.length) return turfs;
  return turfs.map((t, i) => ({ ...t, captain: captains[i % captains.length] }));
}
