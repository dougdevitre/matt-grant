// SMS "insights readiness" — the data-side companion to lib/sms/health.ts
// (which reports the THREE Twilio creds). This reports whether the priority-tier
// presets + budget coverage in the composer are backed by REAL voters yet:
//   1. is the voter file ingested? (VOTERAGG rollups exist)
//   2. when did enrichment last run? (max enrichedAt across the consent ledger)
//   3. what share of opted-in numbers are scored? (voterSegment present)
// It reads voter aggregates + the consent ledger, so it lives in lib/reports/
// (like smsEnrichmentRun.ts) — never under lib/sms/, which must stay voter-free
// (the isolation guard, lib/sms/audiences.voterfile-isolation.test.ts). All
// outputs are counts/booleans — no phone number or name leaves this module.
import "server-only";
import { TABLE, dbConfigured, queryAllPages } from "@/lib/db";
import { listVoterAggs } from "@/lib/voters/store";

export type SmsInsightsReadiness = {
  configured: boolean; // false when the DB isn't configured (everything below is 0/false)
  voterFileLoaded: boolean; // VOTERAGG rollups present → ingest has run for real
  voterFileCount: number; // total voters in the file (sum of the precinct rollups) — the ~500k
  optedIn: number; // opted-in ledger size (the textable audience)
  scored: number; // opted-in rows carrying a voterSegment tag (matched to a voter)
  scoredPct: number; // scored / optedIn * 100 (0 when optedIn is 0)
  lastEnrichedAt: string | null; // most recent enrichedAt across the ledger, or null
  ready: boolean; // voterFileLoaded && scored > 0 → presets show real groups
};

const empty: SmsInsightsReadiness = {
  configured: false,
  voterFileLoaded: false,
  voterFileCount: 0,
  optedIn: 0,
  scored: 0,
  scoredPct: 0,
  lastEnrichedAt: null,
  ready: false,
};

/** One consent-partition read + the voter-agg read, reduced to the readiness shape. */
export async function smsInsightsReadiness(): Promise<SmsInsightsReadiness> {
  if (!dbConfigured) return empty;
  try {
    const [consent, aggs] = await Promise.all([
      queryAllPages({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": "SMSCONSENT" },
      }),
      listVoterAggs(),
    ]);
    let optedIn = 0;
    let scored = 0;
    let lastEnrichedAt: string | null = null;
    for (const c of consent) {
      if (c.status !== "opted_in") continue;
      optedIn++;
      if (typeof c.voterSegment === "string" && c.voterSegment) scored++;
      if (typeof c.enrichedAt === "string" && (!lastEnrichedAt || c.enrichedAt > lastEnrichedAt)) {
        lastEnrichedAt = c.enrichedAt;
      }
    }
    const voterFileLoaded = aggs.length > 0;
    // Total voters = the same per-precinct count sum districtRollup() uses (~178 agg
    // rows, never a 500k scan). This is the top of the funnel the panel shows.
    const voterFileCount = aggs.reduce((n, a) => n + (a.count ?? 0), 0);
    return {
      configured: true,
      voterFileLoaded,
      voterFileCount,
      optedIn,
      scored,
      scoredPct: optedIn > 0 ? (scored / optedIn) * 100 : 0,
      lastEnrichedAt,
      ready: voterFileLoaded && scored > 0,
    };
  } catch {
    return { ...empty, configured: dbConfigured };
  }
}
