import { prisma } from "@/lib/db";
import { loadConfig } from "./config";
import { CongressClient } from "./congressClient";
import { fetchMemberVotes } from "./clerkVotes";
import { persist } from "./store";
import type { NormalizedDataset } from "./types";

// Orchestrates a full ingestion: Congress.gov (member + bills) + Clerk (votes),
// persists via upserts, and records an IngestRun for run-status visibility.
export async function runIngest(): Promise<NormalizedDataset["counts"]> {
  const cfg = loadConfig();
  if (!cfg.apiKey) throw new Error("CONGRESS_GOV_API_KEY is not set");

  const run = await prisma.ingestRun.create({ data: { target: cfg.bioguideId } });
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
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { ok: true, finishedAt: new Date(), counts: dataset.counts },
    });
    return dataset.counts;
  } catch (err) {
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { ok: false, finishedAt: new Date(), error: String(err) },
    });
    throw err;
  }
}
