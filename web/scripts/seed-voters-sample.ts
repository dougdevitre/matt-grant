// Illustrative SYNTHETIC voters for local dev — emphatically NOT the real MO-02
// voter file (that lives only in private S3; see candidate/voter-file-plan.md §2).
// Writes a small, obviously-fake voter universe so the offline dev experience is
// non-empty:
//   - VOTER#<county>#<precinct> shards + VOTERAGG rollups + an INGESTRUN manifest
//     → /dashboard/voters renders a scoreboard, precinct table, and drill-downs.
//   - A handful of SMSCONSENT opt-ins + matching opted-in VOLUNTEER rows (same
//     name + ZIP as some synthetic voters) → the SMS composer shows a non-zero
//     audience AND the Twilio-fund report can join opted-in numbers to voter
//     scores offline.
// Every row carries `seed: true`, so `npm run db:clean-seed` removes it and it can
// never be mistaken for real data. Generation is deterministic (a tiny LCG keyed
// by row index) so re-running the seed overwrites the same keys — idempotent, like
// the rest of seed-dynamo.ts.
import { PK } from "../lib/db";
import { precinctKey } from "../lib/voters/crosswalk";
import {
  turnoutScore,
  supportProxy,
  segmentFor,
  isNewRegistrant,
  type Segment,
} from "../lib/voters/score";
import { newAgg, accumulate, type VoterAgg } from "../lib/voters/aggregate";
import { SEED_SK_PREFIX } from "./seed-constants";

export type PutFn = (item: Record<string, unknown>) => Promise<unknown>;

// A clearly-fake voter universe: real MO-02 counties/cities, but precinct names
// no clerk would ever use ("Seed Precinct …"), so a shard key can never collide
// with a real precinct even in a shared dev table.
const SEED_COUNTY = "St. Louis";
const SEED_PRECINCTS = [
  { name: "Seed Precinct Alpha", city: "Kirkwood", zip: "63122" },
  { name: "Seed Precinct Bravo", city: "Ballwin", zip: "63011" },
  { name: "Seed Precinct Charlie", city: "Chesterfield", zip: "63017" },
] as const;

// The partitions this seeder writes into, so scripts/delete-seed.ts can sweep
// them. Voter rows are SHARDED (one partition per precinct), and the manifest /
// consent partitions aren't plain `PK.<name>` string members, so they're listed
// here explicitly rather than discovered by the seed-shared test's PK scan.
export const SEED_VOTER_PARTITIONS: readonly string[] = [
  PK.voterAgg,
  PK.ingestRuns("voters"),
  "SMSCONSENT", // consent.ts keeps this partition name local; mirror it here
  ...SEED_PRECINCTS.map((p) => PK.voterShard(precinctKey(SEED_COUNTY, p.name))),
];

const FIRST = ["Alex", "Bailey", "Casey", "Devon", "Erin", "Frankie", "Gale", "Harper", "Iris", "Jordan", "Kelsey", "Logan", "Morgan", "Noel", "Quinn", "Riley", "Sage", "Terry", "Val", "Wren"];
const LAST = ["Adler", "Boone", "Calder", "Doyle", "Ellis", "Farrow", "Grady", "Hollis", "Ingram", "Jansen", "Keller", "Larkin", "Mercer", "Novak", "Osborn", "Payne", "Quill", "Reyes", "Sutton", "Tovar"];
const PARTIES = ["", "", "", "", "", "Republican", "Republican", "Democratic", "Libertarian", "Unaffiliated"]; // ~90% blank, like the real file
// Recency of the most recent recorded vote → drives the T score (score.ts).
const LAST_VOTED: ({ date: string; year: number; label: string } | null)[] = [
  { date: "2026-04-07", year: 2026, label: "2026 Municipal General" }, // T5
  { date: "2024-11-05", year: 2024, label: "2024 General" }, // T4
  { date: "2020-11-03", year: 2020, label: "2020 General" }, // T3
  { date: "2018-11-06", year: 2018, label: "2018 General" }, // T2
  null, // T1 — registered, no recorded participation
];

/** Deterministic 0..1 stream (numerical-recipes LCG) — reproducible seeds. */
function lcg(seed: number): () => number {
  let s = (seed * 1664525 + 1013904223) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const pick = <T>(arr: readonly T[], r: number): T => arr[Math.floor(r * arr.length) % arr.length];

type SynthVoter = {
  voterId: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  zip: string;
  county: string;
  precinct: string;
  precinctName: string;
  yob: number | null;
  party?: string;
  regDate: string;
  active: boolean;
  lastVoted: { date: string; year: number; label: string } | null;
  t: number;
  s: number;
  segment: Segment;
  newRegistrant: boolean;
};

function makeVoter(i: number): SynthVoter {
  const rnd = lcg(i + 1);
  const p = SEED_PRECINCTS[i % SEED_PRECINCTS.length];
  const first = pick(FIRST, rnd());
  const last = pick(LAST, rnd());
  const party = pick(PARTIES, rnd()) || undefined;
  const active = rnd() > 0.08; // ~92% active, matching the real census
  const lastVoted = active ? pick(LAST_VOTED, rnd()) : null;
  const yob = 1945 + Math.floor(rnd() * 60);
  // A handful register after the 2024 general → the new-registrant cohort.
  const regDate = rnd() > 0.9 ? "2025-03-14" : "2019-06-01";
  const t = turnoutScore(lastVoted, active);
  const s = supportProxy(party);
  return {
    voterId: `SEEDV${String(i + 1).padStart(4, "0")}`,
    firstName: first,
    lastName: last,
    address: `${100 + i} Sample St`,
    city: p.city,
    zip: p.zip,
    county: SEED_COUNTY,
    precinct: p.name,
    precinctName: p.name,
    yob,
    ...(party ? { party } : {}),
    regDate,
    active,
    lastVoted,
    t,
    s,
    segment: segmentFor(t, s),
    newRegistrant: isNewRegistrant(regDate),
  };
}

const E164 = (n: number) => `+1314555${String(1000 + n).slice(-4)}`;

/**
 * Seed the synthetic voter engine + a matching opt-in audience. `put` is the
 * seed-dynamo helper (stamps `seed: true`); `now` is the shared ISO timestamp.
 * Returns counts for the seed log.
 */
export async function seedVoterSample(
  put: PutFn,
  now: string,
): Promise<{ voters: number; precincts: number; optedIn: number; matched: number }> {
  const COUNT = 120;
  const aggs = new Map<string, VoterAgg>();
  const districtT = [0, 0, 0, 0, 0, 0];
  const districtSeg: Record<string, number> = {};

  const voters: SynthVoter[] = [];
  for (let i = 0; i < COUNT; i++) {
    const v = makeVoter(i);
    voters.push(v);
    const pk = precinctKey(v.county, v.precinctName);
    const agg = aggs.get(pk) ?? newAgg(v.county);
    accumulate(agg, v);
    aggs.set(pk, agg);
    districtT[v.t]++;
    districtSeg[v.segment] = (districtSeg[v.segment] ?? 0) + 1;

    await put({
      PK: PK.voterShard(pk),
      SK: v.voterId,
      firstName: v.firstName,
      lastName: v.lastName,
      address: v.address,
      city: v.city,
      zip: v.zip,
      county: v.county,
      precinct: v.precinct,
      precinctName: v.precinctName,
      yob: v.yob,
      ...(v.party ? { party: v.party } : {}),
      regDate: v.regDate,
      active: v.active,
      lastVoted: v.lastVoted,
      t: v.t,
      s: v.s,
      segment: v.segment,
      newRegistrant: v.newRegistrant,
    });
  }

  // Per-precinct rollups (what the dashboard reads).
  for (const [pk, agg] of aggs) {
    await put({ PK: PK.voterAgg, SK: pk, ...agg, updatedAt: now });
  }

  // Ingest manifest — fixed SK so a re-seed overwrites it (idempotent).
  await put({
    PK: PK.ingestRuns("voters"),
    SK: "2026-07-15T00:00:00.000Z",
    files: [{ file: "SEED (synthetic)", sha256: "seed", rows: COUNT }],
    voters: COUNT,
    skipped: 0,
    precincts: aggs.size,
    byCounty: { [SEED_COUNTY]: COUNT },
    t: districtT,
    segments: districtSeg,
    note: "Illustrative synthetic voters — not the real MO-02 file.",
  });

  // An opt-in audience the SMS composer + report can use. The first 12 synthetic
  // voters double as opted-in VOLUNTEERS (same name + ZIP + a phone), so the
  // report's name+ZIP join to voter scores has real matches; two more numbers are
  // opted-in subscribers with no voter match, and two are opted-out.
  const MATCHED = 12;
  let n = 0;
  for (let i = 0; i < MATCHED; i++) {
    const v = voters[i];
    const phone = E164(i);
    await put({
      PK: PK.volunteers,
      SK: `${SEED_SK_PREFIX}sv${i + 1}`,
      name: `${v.firstName} ${v.lastName}`,
      city: v.city,
      zip: v.zip,
      phone,
      interests: "canvass, gotv",
      status: "ACTIVE",
      smsConsent: true,
      createdAt: now,
    });
    await put({ PK: "SMSCONSENT", SK: phone, status: "opted_in", source: "seed", consentAt: now, updatedAt: now });
    n++;
  }
  // Two opted-in subscribers with no named contact (raw web/keyword opt-ins).
  for (let i = 0; i < 2; i++) {
    await put({ PK: "SMSCONSENT", SK: E164(90 + i), status: "opted_in", source: "seed", consentAt: now, updatedAt: now });
    n++;
  }
  // Two opted-out numbers (STOP) — exercise the suppression path.
  for (let i = 0; i < 2; i++) {
    await put({ PK: "SMSCONSENT", SK: E164(95 + i), status: "opted_out", updatedAt: now });
  }

  return { voters: COUNT, precincts: aggs.size, optedIn: n, matched: MATCHED };
}
