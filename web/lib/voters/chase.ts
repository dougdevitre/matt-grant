// Ballot-chase math (voter-file-plan.md Phase 5 + tactics/ballot-chase-program.md).
// Pure and client-safe: the chase board, the returns-import preview, and the
// per-precinct tier counts all compute through here so the tier definitions
// can't drift from the doc. Tiers map onto the existing segments + T:
//   Tier 1 Chase Hard  = MOBILIZE (identified supporter, infrequent — wins the race)
//   Tier 2 Chase Firm  = BANK with T4 (supporter, moderate propensity)
//   Tier 3 Chase Light = BANK with T5 (supporter, near-certain — one reminder)
//   Tier 4 Persuasion GOTV = PERSUADE (habitual voter, lean unknown)
//   No chase           = MONITOR (opponent/inactive) and PROSPECT (unknown + unlikely)
import type { Segment } from "./score";
import type { VoterAggRow } from "./storeTypes";

export type ChaseTier = "1" | "2" | "3" | "4";
export const CHASE_TIERS: Record<ChaseTier, { name: string; treatment: string }> = {
  "1": { name: "Chase Hard", treatment: "Every round: mail, phone, text, door" },
  "2": { name: "Chase Firm", treatment: "Phone + text; a door knock if resources allow" },
  "3": { name: "Chase Light", treatment: "One text or phone reminder (insurance)" },
  "4": { name: "Persuasion GOTV", treatment: "Persuade + turn out — only once Tiers 1-3 are covered" },
};

/** Segment + T → chase tier, or null for the do-not-chase universes. */
export function chaseTier(segment: Segment, t: number): ChaseTier | null {
  if (segment === "MOBILIZE") return "1";
  if (segment === "BANK") return t >= 5 ? "3" : "2";
  if (segment === "PERSUADE") return "4";
  return null; // MONITOR (opponents/inactive) + PROSPECT (unknown, unlikely)
}

/** Per-precinct banked counters (BALLOTAGG rows) — written by the returns import. */
export type BallotAggRow = {
  precinctKey: string;
  banked: number; // every matched returned ballot, chased or not
  tiers: Record<ChaseTier, number>;
};

export type ChaseReport = {
  universe: number; // sum of tier 1-4 universes
  banked: number; // banked ballots inside those tiers
  bankedAll: number; // every matched return (incl. non-chase voters)
  outstanding: number;
  pctComplete: number; // 0-100, one decimal
  tiers: { tier: ChaseTier; name: string; treatment: string; universe: number; banked: number; outstanding: number; pct: number }[];
  precincts: { precinctKey: string; county: string; universe: number; banked: number; outstanding: number }[]; // sorted by outstanding desc
};

const pct1 = (n: number, d: number) => (d > 0 ? Math.round((1000 * n) / d) / 10 : 0);

/** The Daily Chase Report numbers (ballot-chase-program.md §Daily Chase Report). */
export function chaseReport(aggs: VoterAggRow[], ballotAggs: BallotAggRow[]): ChaseReport {
  const ballotBy = new Map(ballotAggs.map((b) => [b.precinctKey, b]));
  const uni: Record<ChaseTier, number> = { "1": 0, "2": 0, "3": 0, "4": 0 };
  const bank: Record<ChaseTier, number> = { "1": 0, "2": 0, "3": 0, "4": 0 };
  let bankedAll = 0;
  const precincts: ChaseReport["precincts"] = [];
  for (const a of aggs) {
    const tiers = a.tiers ?? { "1": 0, "2": 0, "3": 0, "4": 0 };
    const b = ballotBy.get(a.precinctKey);
    let pUni = 0;
    let pBank = 0;
    for (const t of ["1", "2", "3", "4"] as const) {
      uni[t] += tiers[t] ?? 0;
      pUni += tiers[t] ?? 0;
      const banked = b?.tiers[t] ?? 0;
      bank[t] += banked;
      pBank += banked;
    }
    bankedAll += b?.banked ?? 0;
    precincts.push({
      precinctKey: a.precinctKey,
      county: a.county,
      universe: pUni,
      banked: pBank,
      outstanding: pUni - pBank,
    });
  }
  const universe = uni["1"] + uni["2"] + uni["3"] + uni["4"];
  const banked = bank["1"] + bank["2"] + bank["3"] + bank["4"];
  return {
    universe,
    banked,
    bankedAll,
    outstanding: universe - banked,
    pctComplete: pct1(banked, universe),
    tiers: (["1", "2", "3", "4"] as const).map((t) => ({
      tier: t,
      ...CHASE_TIERS[t],
      universe: uni[t],
      banked: bank[t],
      outstanding: uni[t] - bank[t],
      pct: pct1(bank[t], uni[t]),
    })),
    precincts: precincts.sort((a, b) => b.outstanding - a.outstanding),
  };
}

// ── Returns-file mapping (the county's daily early-vote/absentee export) ─────

export type ReturnRow = { voterId: string; votedAt?: string; method?: string };

type Field = "voterId" | "votedAt" | "method";
const HEADER_ALIASES: Record<string, Field> = {
  "voter id": "voterId", voterid: "voterId", voter_id: "voterId", id: "voterId",
  date: "votedAt", "voted date": "votedAt", voted_date: "votedAt", voted: "votedAt", "ballot date": "votedAt",
  method: "method", "ballot type": "method", ballot_type: "method", type: "method", channel: "method",
};

export type ReturnMapResult = {
  valid: ReturnRow[];
  skipped: number; // rows without a voter id
  total: number;
  mappedColumns: Field[];
};

/** Map parsed CSV rows (first row = header) into returns. Only a voter id is
 *  required — the county file's other columns pass through when recognized. */
export function mapReturnRows(rows: string[][]): ReturnMapResult {
  if (rows.length < 2) return { valid: [], skipped: 0, total: 0, mappedColumns: [] };
  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()]);
  const mappedColumns = [...new Set(header.filter((f): f is Field => Boolean(f)))];
  const valid: ReturnRow[] = [];
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const get = (f: Field) => {
      const idx = header.indexOf(f);
      return idx >= 0 ? (rows[i][idx] ?? "").trim() : "";
    };
    const voterId = get("voterId").slice(0, 40);
    if (!voterId) {
      skipped++;
      continue;
    }
    const votedAt = get("votedAt").slice(0, 20);
    const method = get("method").slice(0, 24);
    valid.push({ voterId, ...(votedAt ? { votedAt } : {}), ...(method ? { method } : {}) });
  }
  return { valid, skipped, total: rows.length - 1, mappedColumns };
}
