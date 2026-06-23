import { describe, it, expect } from "vitest";
import { finalizeUpdateExpression, normalizeRecipient } from "@/lib/campaigns";

// Regression guard for C1: the drained-batch counter update once started with
// "ADD ... SET ...", which DynamoDB rejects (clause order must be SET → ADD).
// Because the throw happened AFTER mail was sent and the cursor advanced, counts
// never incremented and the campaign hung "sending". These assertions fail fast
// if the ordering ever regresses.
describe("finalizeUpdateExpression", () => {
  for (const done of [true, false]) {
    it(`puts SET before ADD (valid DynamoDB order) when done=${done}`, () => {
      const expr = finalizeUpdateExpression(done);
      expect(expr).toMatch(/^SET\b/);
      expect(expr).not.toMatch(/^ADD/);
      expect(expr.indexOf("SET")).toBeLessThan(expr.indexOf("ADD"));
      // ADD must appear exactly once (DynamoDB allows one ADD section).
      expect(expr.match(/\bADD\b/g)?.length).toBe(1);
      // Always increments both counters.
      expect(expr).toContain("sentCount :sd");
      expect(expr).toContain("suppressedCount :pd");
    });
  }

  it("finalizes status + finishedAt only on the last batch", () => {
    expect(finalizeUpdateExpression(true)).toContain("#s = :sent");
    expect(finalizeUpdateExpression(true)).toContain("finishedAt = :u");
    expect(finalizeUpdateExpression(false)).not.toContain("#s");
    expect(finalizeUpdateExpression(false)).not.toContain("finishedAt");
  });
});

describe("normalizeRecipient", () => {
  it("upgrades a legacy bare-email string to a recipient object", () => {
    expect(normalizeRecipient("a@b.co")).toEqual({ email: "a@b.co" });
  });
  it("keeps an object recipient, preserving a first name", () => {
    expect(normalizeRecipient({ email: "a@b.co", firstName: "Sam" })).toEqual({ email: "a@b.co", firstName: "Sam" });
  });
  it("omits an empty first name so the greeting falls back", () => {
    expect(normalizeRecipient({ email: "a@b.co" })).toEqual({ email: "a@b.co" });
  });
});
