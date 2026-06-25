// Shared definition of "what is a seed record" — imported by both the seed
// loader (scripts/seed-dynamo.ts) and the cleanup script (scripts/delete-seed.ts)
// so the two can never drift on which rows count as illustrative sample data.
import { PK } from "../lib/db";

// Every seeded row gets a deterministic sort key `seed-1`, `seed-2`, … and (newer
// rows) a `seed: true` marker. Either is sufficient to identify a seed record;
// the marker survives even if the SK scheme ever changes.
export const SEED_SK_PREFIX = "seed-";

// The partitions the seed loader writes into. The cleanup script sweeps exactly
// these — keep this list in lockstep with seed-dynamo.ts (the test enforces it).
export const SEED_PARTITIONS: readonly string[] = [
  PK.donors,
  PK.expenditures,
  PK.volunteers,
  PK.tasks,
  PK.milestones,
];

type Item = { SK?: unknown; seed?: unknown };

// True when a DynamoDB item is illustrative seed data: either its sort key carries
// the `seed-` prefix or it has the explicit `seed: true` marker.
export function isSeedItem(item: Item): boolean {
  if (item.seed === true) return true;
  return typeof item.SK === "string" && item.SK.startsWith(SEED_SK_PREFIX);
}
