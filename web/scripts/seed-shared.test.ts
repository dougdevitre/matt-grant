import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PK } from "../lib/db";
import { SEED_PARTITIONS, isSeedItem } from "./seed-shared";

describe("isSeedItem", () => {
  it("flags rows with a seed- sort key", () => {
    expect(isSeedItem({ SK: "seed-12" })).toBe(true);
    expect(isSeedItem({ SK: "seed-1" })).toBe(true);
  });

  it("flags rows carrying the seed:true marker", () => {
    expect(isSeedItem({ SK: "c1f3-not-a-seed-sk", seed: true })).toBe(true);
  });

  it("leaves real rows alone", () => {
    expect(isSeedItem({ SK: crypto.randomUUID() })).toBe(false);
    expect(isSeedItem({ SK: "e:voter@example.com" })).toBe(false);
    expect(isSeedItem({})).toBe(false);
  });
});

describe("SEED_PARTITIONS", () => {
  it("covers every partition the seed loader writes", () => {
    // Lock the cleanup sweep to the seed loader: scan the seed scripts for the
    // string-valued PK.* keys they put into, and assert each resolves to a
    // partition in SEED_PARTITIONS. A new entity added to the seed without
    // updating SEED_PARTITIONS fails here. (Function-valued PK builders — sharded
    // voter partitions, INGESTRUN — and the local SMSCONSENT name aren't string
    // members, so seed-voters-sample.ts lists those explicitly in
    // SEED_VOTER_PARTITIONS.)
    const src = ["./seed-dynamo.ts", "./seed-voters-sample.ts"]
      .map((f) => readFileSync(new URL(f, import.meta.url), "utf8"))
      .join("\n");
    const used = new Set<string>();
    for (const m of src.matchAll(/PK\.(\w+)/g)) {
      const value = (PK as Record<string, unknown>)[m[1]];
      if (typeof value === "string") used.add(value);
    }
    expect(used.size).toBeGreaterThan(0);
    for (const pk of used) expect(SEED_PARTITIONS).toContain(pk);
  });
});
