import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK } from "@/lib/db";
import { loadConfig } from "./config";
import { CongressClient } from "./congressClient";
import { fetchMemberVotes } from "./clerkVotes";
import { persist } from "./store";
import type { NormalizedDataset } from "./types";

// Orchestrates a full ingestion: Congress.gov (member + bills) + Clerk (votes),
// persists via upserts, and records an IngestRun item for run-status visibility.
export async function runIngest(): Promise<NormalizedDataset["counts"]> {
  const cfg = loadConfig();
  if (!cfg.apiKey) throw new Error("CONGRESS_GOV_API_KEY is not set");

  const startedAt = new Date().toISOString();
  const runKey = { PK: PK.ingestRuns(cfg.bioguideId), SK: startedAt };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: { ...runKey, target: cfg.bioguideId, ok: false, startedAt } }));

  try {
    const client = new CongressClient(cfg.apiKey);
    const [member, sponsored, cosponsored, votes] = await Promise.all([
      client.getMember(cfg.bioguideId),
      client.getSponsored(cfg.bioguideId),
      client.getCosponsored(cfg.bioguideId),
      fetchMemberVotes(cfg.bioguideId, cfg.voteYear, cfg.fromRoll, cfg.toRoll),
    ]);

    const dataset: NormalizedDataset = {
      generatedAt: new Date().toISOString(),
      bioguideId: cfg.bioguideId,
      member,
      sponsored,
      cosponsored,
      votes,
      counts: { sponsored: sponsored.length, cosponsored: cosponsored.length, votes: votes.length },
    };

    await persist(dataset);
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: { ...runKey, target: cfg.bioguideId, ok: true, startedAt, finishedAt: new Date().toISOString(), counts: dataset.counts },
      }),
    );
    return dataset.counts;
  } catch (err) {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: { ...runKey, target: cfg.bioguideId, ok: false, startedAt, finishedAt: new Date().toISOString(), error: String(err) },
      }),
    );
    throw err;
  }
}
