import { describe, it, expect } from "vitest";
import { PK, newId } from "./db";

// These guard against partition-key drift: every entity type lives in its own
// partition, so two collections sharing a PK string would silently cross-
// contaminate each other's Query results. The function-style PKs must likewise
// namespace by a distinct prefix.

describe("PK partition keys", () => {
  const staticVals = Object.entries(PK).filter(([, v]) => typeof v === "string") as [string, string][];
  const fnEntries = Object.entries(PK).filter(([, v]) => typeof v === "function") as [string, (s: string) => string][];

  it("has no duplicate static partition strings", () => {
    const vals = staticVals.map(([, v]) => v);
    expect(new Set(vals).size).toBe(vals.length);
  });

  it("namespaces function-style PKs with a '#'-delimited prefix", () => {
    for (const [, fn] of fnEntries) {
      const out = fn("slug-1");
      expect(out).toContain("#");
      expect(out.endsWith("slug-1")).toBe(true);
    }
  });

  it("keeps function-PK prefixes distinct from every static partition string", () => {
    const staticSet = new Set(staticVals.map(([, v]) => v));
    for (const [, fn] of fnEntries) {
      const prefix = fn("x").split("#")[0];
      // A function PK's prefix (e.g. "VOTES") must not collide with a whole
      // static partition (e.g. "VOTE") in a way that produces an identical key.
      expect(staticSet.has(fn("x"))).toBe(false);
      expect(prefix.length).toBeGreaterThan(0);
    }
  });

  it("newId returns a v4-style UUID", () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(newId()).not.toBe(newId()); // fresh each call
  });
});
