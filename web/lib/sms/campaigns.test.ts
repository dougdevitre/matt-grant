import { describe, it, expect } from "vitest";
import {
  RECIPIENT_BYTES_BUDGET,
  chunkRecipients,
  finalizeSmsUpdateExpression,
  withinSendWindow,
  drainSmsOnce,
  personalizeBody,
  recipientBytes,
} from "./campaigns";

describe("chunkRecipients (DynamoDB 400 KB item ceiling)", () => {
  const rec = (i: number) => ({ phone: `+1314555${String(i).padStart(4, "0")}`, first: "Sam" });
  const many = (n: number) => Array.from({ length: n }, (_, i) => rec(i));

  it("keeps a small audience in a single chunk", () => {
    expect(chunkRecipients(many(500))).toHaveLength(1);
  });

  it("returns no chunks for an empty audience", () => {
    expect(chunkRecipients([])).toEqual([]);
  });

  it("splits an audience that would exceed the item limit", () => {
    // 100k recipients is far past what one item holds — the case that used to
    // throw an unhandled ValidationException and write no campaign at all.
    const chunks = chunkRecipients(many(100_000));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.reduce((n, r) => n + recipientBytes(r), 0)).toBeLessThanOrEqual(RECIPIENT_BYTES_BUDGET);
    }
  });

  it("loses nobody and preserves priority order across the split", () => {
    // The upstream ranking (rankForBroadcast) is the whole point: chunk 1 must
    // hold the highest-priority recipients, and concatenating chunks must
    // reproduce the original order exactly.
    const input = many(50_000);
    const flat = chunkRecipients(input).flat();
    expect(flat).toHaveLength(input.length);
    expect(flat.map((r) => r.phone)).toEqual(input.map((r) => r.phone));
  });

  it("splits exactly at the boundary, not one recipient early or late", () => {
    const budget = recipientBytes(rec(0)) * 10;
    expect(chunkRecipients(many(10), budget)).toHaveLength(1);
    expect(chunkRecipients(many(11), budget)).toHaveLength(2);
    expect(chunkRecipients(many(11), budget)[0]).toHaveLength(10);
  });

  it("still emits an oversized single recipient rather than dropping it", () => {
    // Losing a recipient silently is the one unacceptable outcome.
    const huge = { phone: "+13145550000", first: "x".repeat(1000) };
    expect(chunkRecipients([huge], 10)).toEqual([[huge]]);
  });

  it("handles legacy plain-string recipients", () => {
    const legacy = Array.from({ length: 100 }, (_, i) => `+1314555${String(i).padStart(4, "0")}`);
    expect(chunkRecipients(legacy).flat()).toEqual(legacy);
  });
});

describe("personalizeBody (first-name merge)", () => {
  it("replaces the {first} token per recipient, falling back to 'there'", () => {
    expect(personalizeBody("Hi {first}, vote Aug 4.", "Jordan")).toBe("Hi Jordan, vote Aug 4.");
    expect(personalizeBody("Hi {first}, vote Aug 4.")).toBe("Hi there, vote Aug 4.");
  });
  it("leaves a body without the token untouched (non-personalized campaigns)", () => {
    expect(personalizeBody("Vote Aug 4.", "Jordan")).toBe("Vote Aug 4.");
  });
});

describe("finalizeSmsUpdateExpression", () => {
  it("orders SET before ADD (DynamoDB rejects ADD-first) and only sets status when done", () => {
    const mid = finalizeSmsUpdateExpression(false);
    const done = finalizeSmsUpdateExpression(true);
    expect(mid.indexOf("SET")).toBeLessThan(mid.indexOf("ADD"));
    expect(mid).not.toContain("#s = :sent");
    expect(done).toContain("#s = :sent");
    expect(done).toContain("finishedAt");
    expect(done.indexOf("SET")).toBeLessThan(done.indexOf("ADD"));
  });

  it("accumulates sent, skipped, and failed counters separately", () => {
    for (const done of [false, true]) {
      const e = finalizeSmsUpdateExpression(done);
      expect(e).toContain("sentCount :sd");
      expect(e).toContain("skippedCount :pd");
      expect(e).toContain("failedCount :fd");
    }
  });
});

describe("withinSendWindow (9am–8pm CT)", () => {
  it("allows mid-afternoon CT and blocks the middle of the night", () => {
    // 2026-06-15 18:00Z = 1:00pm CDT (allowed); 06:00Z = 1:00am CDT (blocked).
    expect(withinSendWindow(new Date("2026-06-15T18:00:00Z"))).toBe(true);
    expect(withinSendWindow(new Date("2026-06-15T06:00:00Z"))).toBe(false);
  });

  it("blocks after 8pm CT", () => {
    // 2026-06-16T02:30:00Z = 9:30pm CDT (blocked).
    expect(withinSendWindow(new Date("2026-06-16T02:30:00Z"))).toBe(false);
  });
});

describe("drainSmsOnce", () => {
  it("no-ops without a database (returns null)", async () => {
    // DYNAMODB_TABLE is unset in tests → dbConfigured is false.
    expect(await drainSmsOnce()).toBeNull();
  });
});
