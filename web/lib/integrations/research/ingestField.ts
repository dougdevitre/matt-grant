import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK } from "@/lib/db";
import { loadField, type Candidate } from "./candidates";
import { persistCandidates, persistFec, persistDonorProfile, persistStateLeg } from "./store";
import { FecClient, fecEnabled } from "../fec/client";
import { OpenStatesClient, openStatesEnabled } from "../openstates/client";
import { CongressClient } from "../legislative/congressClient";
import { fetchMemberVotes } from "../legislative/clerkVotes";
import { persist as persistLegislative } from "../legislative/store";
import type { NormalizedDataset } from "../legislative/types";

export type FieldIngestResult = {
  candidates: number;
  fec: number;
  federal: number;
  stateLeg: number;
  perCandidate: Record<
    string,
    { fec?: boolean; federal?: { votes: number; bills: number }; stateLeg?: number; error?: string }
  >;
};

const cycle = Number(process.env.RESEARCH_FEC_CYCLE ?? "2026");
const voteYear = Number(process.env.RESEARCH_VOTE_YEAR ?? "2025");
const fromRoll = Number(process.env.RESEARCH_FROM_ROLL ?? "1");
const toRoll = Number(process.env.RESEARCH_TO_ROLL ?? "60");

// Federal record for a sitting/former member (Congress.gov + House Clerk).
async function ingestFederal(c: Candidate): Promise<{ votes: number; bills: number }> {
  const apiKey = process.env.CONGRESS_GOV_API_KEY;
  if (!apiKey || !c.bioguideId) return { votes: 0, bills: 0 };
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
  return { votes: votes.length, bills: sponsored.length + cosponsored.length };
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
  await Promise.all(
    field.map(async (c) => {
      const entry: FieldIngestResult["perCandidate"][string] = {};
      try {
        if (fec && c.fecCandidateId) {
          const [summary, donors] = await Promise.all([
            fec.getSummary(c.fecCandidateId, cycle),
            fec.getDonorProfile(c.fecCandidateId, cycle),
          ]);
          await Promise.all([persistFec(c.slug, summary), persistDonorProfile(c.slug, donors)]);
          entry.fec = true;
          result.fec += 1;
        }
        if (c.bioguideId && process.env.CONGRESS_GOV_API_KEY) {
          entry.federal = await ingestFederal(c);
          result.federal += 1;
        }
        if (openStates && c.stateLegId) {
          const record = await openStates.getRecord(c.stateLegId);
          await persistStateLeg(c.slug, record);
          entry.stateLeg = record.sponsored.length;
          result.stateLeg += 1;
        }
      } catch (err) {
        entry.error = String(err);
      }
      result.perCandidate[c.slug] = entry;
    }),
  );

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: PK.ingestRuns("FIELD"), SK: startedAt, ok: true, startedAt, finishedAt: new Date().toISOString(), counts: result },
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
