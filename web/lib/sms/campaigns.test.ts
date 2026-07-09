import { describe, it, expect } from "vitest";
import { finalizeSmsUpdateExpression, withinSendWindow, drainSmsOnce } from "./campaigns";

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
