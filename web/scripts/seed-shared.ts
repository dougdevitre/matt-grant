// Shared definition of "what is a seed record" — imported by both the seed
// loader (scripts/seed-dynamo.ts) and the cleanup script (scripts/delete-seed.ts)
// so the two can never drift on which rows count as illustrative sample data.
import { PK } from "../lib/db";
import { SEED_VOTER_PARTITIONS } from "./seed-voters-sample";
import { SEED_SK_PREFIX } from "./seed-constants";

// Re-exported from the leaf constants module (breaks the seed-shared ⇄
// seed-voters-sample import cycle). Deterministic `seed-N` sort keys + a
// `seed: true` marker identify sample rows; either signal is sufficient.
export { SEED_SK_PREFIX };

// The partitions the seed loader writes into. The cleanup script sweeps exactly
// these — keep this list in lockstep with seed-dynamo.ts (the test enforces it).
export const SEED_PARTITIONS: readonly string[] = [
  PK.donors,
  PK.expenditures,
  PK.volunteers,
  PK.tasks,
  PK.milestones,
  // Synthetic voter engine + opt-in audience (scripts/seed-voters-sample.ts):
  // the VOTERAGG / INGESTRUN / SMSCONSENT partitions and the per-precinct voter
  // shards. Only rows carrying `seed: true` are ever swept, so real ingest data
  // in these same partitions is left untouched by db:clean-seed.
  ...SEED_VOTER_PARTITIONS,
];

type Item = { SK?: unknown; seed?: unknown };

// True when a DynamoDB item is illustrative seed data: either its sort key carries
// the `seed-` prefix or it has the explicit `seed: true` marker.
export function isSeedItem(item: Item): boolean {
  if (item.seed === true) return true;
  return typeof item.SK === "string" && item.SK.startsWith(SEED_SK_PREFIX);
}
