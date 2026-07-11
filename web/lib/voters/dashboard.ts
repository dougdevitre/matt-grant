// Pure rollup/filter/export logic for the voters dashboard — client-safe so the
// explorer filters and CSV builds run in the browser on already-fetched rows.
// RSMo 115.157: every export carries the political-use-only notice line.
import { toCsv } from "@/lib/contacts/import";
import { SEGMENTS, type Segment } from "./score";
import { ageBand, type AgeBand } from "./parse";
import type { StoredVoter, VoterAggRow } from "./storeTypes";

export const RSMO_NOTICE =
  "Missouri voter registration data (RSMo 115.157): political/election purposes only — never commercial use, publication, or resale. Handle per candidate/voter-file-plan.md.";

export type DistrictRollup = {
  voters: number;
  active: number;
  newReg: number;
  t: number[]; // 0-5
  seg: Record<Segment, number>;
  byCounty: { county: string; voters: number; share: number }[];
  precincts: number;
};

export function districtRollup(aggs: VoterAggRow[]): DistrictRollup {
  const t = [0, 0, 0, 0, 0, 0];
  const seg = Object.fromEntries(SEGMENTS.map((s) => [s, 0])) as Record<Segment, number>;
  const county = new Map<string, number>();
  let voters = 0;
  let active = 0;
  let newReg = 0;
  for (const a of aggs) {
    voters += a.count;
    active += a.active;
    newReg += a.newReg;
    a.t.forEach((n, i) => (t[i] += n));
    for (const s of SEGMENTS) seg[s] += a.seg[s] ?? 0;
    county.set(a.county, (county.get(a.county) ?? 0) + a.count);
  }
  const byCounty = [...county.entries()]
    .map(([c, n]) => ({ county: c, voters: n, share: voters ? n / voters : 0 }))
    .sort((x, y) => y.voters - x.voters);
  return { voters, active, newReg, t, seg, byCounty, precincts: aggs.length };
}

export type VoterFilters = {
  segment?: Segment | "";
  minT?: number;
  ageBand?: AgeBand | "";
  street?: string; // case-insensitive substring on address
};

export function filterVoters(voters: StoredVoter[], f: VoterFilters): StoredVoter[] {
  const street = (f.street ?? "").trim().toLowerCase();
  return voters.filter(
    (v) =>
      (!f.segment || v.segment === f.segment) &&
      (f.minT == null || v.t >= f.minT) &&
      (!f.ageBand || ageBand(v.yob) === f.ageBand) &&
      (!street || v.address.toLowerCase().includes(street)),
  );
}

/**
 * Drop already-banked voters (ballot returned/voted early) from a list — the
 * chase doc's rule: mark banked AND remove from contact lists. `hide` is the
 * explorer's toggle (default ON); off keeps everyone so a deliberate include
 * stays possible. Unknown ids in `banked` are ignored.
 */
export function excludeBanked(
  voters: StoredVoter[],
  banked: Record<string, string>,
  hide: boolean,
): StoredVoter[] {
  if (!hide) return voters;
  return voters.filter((v) => !(v.voterId in banked));
}

export type ExportKind = "walk" | "mail" | "call";

// Column sets per channel. Walk lists carry the 1-5 canvass-ID column (blank —
// filled at the door, written back in Phase 5); mail carries the mailing
// address; call carries a phone column that is EMPTY unless matched (the file
// has no phones — voter-file-plan.md §6).
const HEADERS: Record<ExportKind, string[]> = {
  walk: ["Voter ID", "Name", "Address", "Unit", "City", "Zip", "Age band", "T", "Segment", "Canvass ID (1-5)", "Not home", "Notes"],
  mail: ["Voter ID", "Name", "Mailing address", "City", "Zip", "Segment", "Age band"],
  call: ["Voter ID", "Name", "City", "Zip", "Segment", "T", "Phone (matched only — file has none)", "Result"],
};

// Excel formula-injection guard: a cell beginning =, +, - or @ executes when the
// CSV is opened in a spreadsheet. Voter names/addresses come from an official
// file, but exports get opened in Excel constantly — neutralize defensively.
const safeCell = (s: string) => (/^[=+\-@]/.test(s) ? `'${s}` : s);

// `phones` (voterId → matched phone from campaign records) fills the call
// list's phone column for matched voters ONLY — manual dial, never texting.
export function votersToCsv(voters: StoredVoter[], kind: ExportKind, phones: Record<string, string> = {}): string {
  const name = (v: StoredVoter) => safeCell(`${v.lastName}, ${v.firstName}`);
  const rows: string[][] = voters.map((v) => {
    const band = ageBand(v.yob);
    if (kind === "walk")
      return [v.voterId, name(v), safeCell(v.address), v.unit ?? "", v.city, v.zip, band, String(v.t), v.segment, "", "", ""];
    if (kind === "mail") return [v.voterId, name(v), safeCell([v.address, v.unit].filter(Boolean).join(" ")), v.city, v.zip, v.segment, band];
    return [v.voterId, name(v), v.city, v.zip, v.segment, String(v.t), safeCell(phones[v.voterId] ?? ""), ""];
  });
  // Notice line first (single header cell), then the real column row —
  // spreadsheet apps show it as a banner; toCsv keeps every cell formula-safe.
  return toCsv([RSMO_NOTICE], [HEADERS[kind], ...rows]);
}
