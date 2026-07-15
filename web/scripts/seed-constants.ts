// Leaf constants shared by the seed loader, the cleanup sweep, and the
// synthetic-voter seeder — kept dependency-free so those modules can import it
// without forming an import cycle (seed-shared ⇄ seed-voters-sample).

// Every seeded row gets a deterministic sort key `seed-1`, `seed-2`, … (and a
// `seed: true` marker), so a re-seed overwrites the same keys and db:clean-seed
// can identify sample data by either signal.
export const SEED_SK_PREFIX = "seed-";
