import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK } from "@/lib/db";
import { loadField, type Candidate } from "./candidates";
import { persistCandidates, persistFec, persistDonorProfile, persistFecDetail, persistStateLeg, persistTimeline, persistWikiBio } from "./store";
import { fetchWikiBio } from "../wikipedia/client";
import { buildTimeline } from "./timeline";
import { FecClient, fecEnabled } from "../fec/client";
import { OpenStatesClient, openStatesEnabled } from "../openstates/client";
import { CongressClient } from "../legislative/congressClient";
import { fetchMemberVotes } from "../legislative/clerkVotes";
import { persist as persistLegislative } from "../legislative/store";
import { mapLimit } from "../http";
import type { NormalizedDataset } from "../legislative/types";

export type FieldIngestResult = {
  candidates: number;
  fec: number;
  federal: number;
  stateLeg: number;
  perCandidate: Record<
    string,
    { fec?: boolean; federal?: { votes: number; bills: number }; stateLeg?: number; timeline?: number; bio?: boolean; error?: string }
  >;
};

const cycle = Number(process.env.RESEARCH_FEC_CYCLE ?? "2026");
const voteYear = Number(process.env.RESEARCH_VOTE_YEAR ?? "2025");
const fromRoll = Number(process.env.RESEARCH_FROM_ROLL ?? "1");
const toRoll = Number(process.env.RESEARCH_TO_ROLL ?? "60");

// Federal record for a sitting/former member (Congress.gov + House Clerk).
// Returns the fetched bills so the timeline can reuse them (no second paginate).
type FederalResult = {
  counts: { votes: number; bills: number };
  bills: { relation: string; congress: number }[];
};
async function ingestFederal(c: Candidate): Promise<FederalResult> {
  const apiKey = process.env.CONGRESS_GOV_API_KEY;
  if (!apiKey || !c.bioguideId) return { counts: { votes: 0, bills: 0 }, bills: [] };
  const client = new CongressClient(apiKey);
  const [member, sponsored, cosponsored, votes] = await Promise.all([
    client.getMember(c.bioguideId),
    client.getSponsored(c.bioguideId),
    client.getCosponsored(c.bioguideId),
    fetchMemberVotes(c.bioguideId, voteYear, fromRoll, toRoll),
  ]);
  const dataset: NormalizedDataset = {
    generatedAt: new Date().toISOString(),
    bioguideId: c.bioguideId,
    member,
    sponsored,
    cosponsored,
    votes,
    counts: { sponsored: sponsored.length, cosponsored: cosponsored.length, votes: votes.length },
  };
  await persistLegislative(dataset);
  return {
    counts: { votes: votes.length, bills: sponsored.length + cosponsored.length },
    bills: [...sponsored, ...cosponsored].map((b) => ({ relation: b.relation, congress: b.congress })),
  };
}

// Ingests the entire field: roster → FEC (all who have an FEC id) → federal
// record (members only). Curated statements are config-driven and need no ingest.
export async function runFieldIngest(): Promise<FieldIngestResult> {
  const field = loadField().filter((c) => c.active !== false);
  const startedAt = new Date().toISOString();
  await ddb.send(new PutCommand({ TableName: TABLE, Item: { PK: PK.ingestRuns("FIELD"), SK: startedAt, ok: false, startedAt } }));

  await persistCandidates(field);
  const result: FieldIngestResult = { candidates: field.length, fec: 0, federal: 0, stateLeg: 0, perCandidate: {} };
  const fec = fecEnabled ? new FecClient() : null;
  const openStates = openStatesEnabled ? new OpenStatesClient() : null;

  // Candidates run concurrently — sequential was slow enough (FEC summary +
  // donor aggregates + federal pull per candidate) to hit the gateway timeout.
  // Cap concurrency so the per-candidate fan-out (each does several FEC calls)
  // doesn't burst past upstream rate limits. H4.
  await mapLimit(field, 4, async (c) => {
      // Each enrichment is isolated: the incumbent's heavy FEC/congress queries
      // time out under load, and a single failure must NOT abort the candidate's
      // OTHER data (the coarse try/catch used to drop the bio + timeline). Every
      // step degrades independently and records its own error.
      const entry: FieldIngestResult["perCandidate"][string] = {};
      const errs: string[] = [];

      // FEC — summary / donor profile / detail persisted independently.
      if (fec && c.fecCandidateId) {
        const fid = c.fecCandidateId;
        const [s, d, det] = await Promise.allSettled([fec.getSummary(fid, cycle), fec.getDonorProfile(fid, cycle), fec.getDetail(fid, cycle)]);
        if (s.status === "fulfilled") {
          try { await persistFec(c.slug, s.value); entry.fec = true; result.fec += 1; } catch (e) { errs.push(`fec.persist: ${String(e)}`); }
        } else errs.push(`fec.summary: ${String(s.reason)}`);
        if (d.status === "fulfilled") { await persistDonorProfile(c.slug, d.value).catch((e) => errs.push(`donor.persist: ${String(e)}`)); } else errs.push(`fec.donors: ${String(d.reason)}`);
        if (det.status === "fulfilled") { await persistFecDetail(c.slug, det.value).catch((e) => errs.push(`detail.persist: ${String(e)}`)); } else errs.push(`fec.detail: ${String(det.reason)}`);
      }

      // Federal record (Congress.gov + House Clerk) — sitting/former members only.
      let federalBills: { relation: string; congress: number }[] | undefined;
      if (c.bioguideId && process.env.CONGRESS_GOV_API_KEY) {
        try {
          const fed = await ingestFederal(c);
          entry.federal = fed.counts;
          federalBills = fed.bills;
          result.federal += 1;
        } catch (e) { errs.push(`federal: ${String(e)}`); }
      }

      if (openStates && c.stateLegId) {
        try {
          const record = await openStates.getRecord(c.stateLegId);
          await persistStateLeg(c.slug, record);
          entry.stateLeg = record.sponsored.length;
          result.stateLeg += 1;
        } catch (e) { errs.push(`stateLeg: ${String(e)}`); }
      }

      // Wikipedia bio — any candidate; guarded resolution avoids the wrong person.
      try {
        const bio = await fetchWikiBio(c.name, c.wikipediaTitle ?? undefined);
        if (bio) { await persistWikiBio(c.slug, bio); entry.bio = true; }
      } catch (e) { errs.push(`bio: ${String(e)}`); }

      // Tenure timeline — reuse the federal bills if that step succeeded.
      if (c.bioguideId || c.fecCandidateId) {
        try {
          const timeline = await buildTimeline(c, federalBills ? { bills: federalBills } : undefined);
          await persistTimeline(c.slug, timeline);
          entry.timeline = timeline.totalTerms;
        } catch (e) { errs.push(`timeline: ${String(e)}`); }
      }

      if (errs.length) entry.error = errs.join("; ");
      result.perCandidate[c.slug] = entry;
  });

  // Derive ok from the actual outcome — don't hardcode true, or monitoring shows
  // green on a total failure (every candidate errored). M8.
  const cands = Object.values(result.perCandidate) as Array<{ error?: string }>;
  const failed = cands.filter((c) => c.error).length;
  const ok = cands.length === 0 || failed < cands.length;
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: PK.ingestRuns("FIELD"), SK: startedAt, ok, errors: failed, startedAt, finishedAt: new Date().toISOString(), counts: result },
    }),
  );
  return result;
}

export async function lastFieldIngest(): Promise<{ ok: boolean; startedAt: string; counts?: unknown } | null> {
  const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
  const out = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: { ":p": PK.ingestRuns("FIELD") },
      ScanIndexForward: false,
      Limit: 1,
    }),
  );
  const it = out.Items?.[0];
  return it ? { ok: Boolean(it.ok), startedAt: String(it.startedAt), counts: it.counts } : null;
}
