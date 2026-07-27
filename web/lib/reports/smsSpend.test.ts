import { describe, it, expect } from "vitest";
import { spendModel, coverageRows, replyCostCents, balanceCheck, COVERAGE_ORDER, ILLUSTRATIVE_COUNTS, UNSCORED_KEY } from "./smsSpend";

// Cents throughout: base 0.79¢/seg + 0.45¢/seg carrier ≈ Twilio toll-free planning figures.
const PRICING = { basePerSegCents: 0.79, carrierPerSegCents: 0.45 };

describe("spendModel", () => {
  const base = { segments: 2, ...PRICING, replyRatePct: 0, listSize: 1000, sends: 7, budgetCents: 0 };

  it("prices a text as segments x (base + carrier)", () => {
    const m = spendModel(base);
    expect(m.perTextCents).toBeCloseTo(2 * 1.24, 6);
    expect(m.perBlastCents).toBeCloseTo(1000 * 2.48, 4);
    expect(m.calendarCents).toBeCloseTo(7 * 1000 * 2.48, 3);
  });

  it("loads expected replies: inbound base segment + a 2-segment agent answer", () => {
    expect(replyCostCents(0.79, 0.45)).toBeCloseTo(0.79 + 2 * 1.24, 6);
    const m = spendModel({ ...base, replyRatePct: 10 });
    expect(m.perTextCents).toBeCloseTo(2.48 + 0.1 * 3.27, 4);
  });

  it("no budget entered → no cap", () => {
    expect(spendModel(base).capPerBlast).toBeNull();
    expect(spendModel(base).coveragePct).toBe(100);
  });

  it("a sufficient budget → no cap needed", () => {
    // 7 sends x 1000 x 2.48¢ = $173.60; give $200.
    const m = spendModel({ ...base, budgetCents: 20000 });
    expect(m.capPerBlast).toBeNull();
  });

  it("a tight budget → floor(budget / sends / perText), with coverage %", () => {
    // $70 across 7 sends = $10/blast = 1000¢ / 2.48¢ = 403 texts.
    const m = spendModel({ ...base, budgetCents: 7000 });
    expect(m.capPerBlast).toBe(403);
    expect(m.coveragePct).toBeCloseTo(40.3, 1);
  });

  it("is defensive about junk inputs", () => {
    const m = spendModel({ segments: -1, basePerSegCents: -5, carrierPerSegCents: -1, replyRatePct: 400, listSize: -10, sends: 0, budgetCents: -3 });
    expect(m.perTextCents).toBe(0);
    expect(m.perBlastCents).toBe(0);
    expect(m.capPerBlast).toBeNull();
  });
});

describe("coverageRows", () => {
  it("orders by send-path priority: MOBILIZE, BANK, PERSUADE, PROSPECT, unscored, MONITOR", () => {
    expect(COVERAGE_ORDER).toEqual(["MOBILIZE", "BANK", "PERSUADE", "PROSPECT", UNSCORED_KEY, "MONITOR"]);
  });

  it("accumulates texts + dollars and flags where the cap lands", () => {
    const rows = coverageRows(ILLUSTRATIVE_COUNTS, 2.48, 1500);
    const by = new Map(rows.map((r) => [r.key, r]));
    expect(by.get("MOBILIZE")).toMatchObject({ cumulative: 600, status: "within" });
    expect(by.get("BANK")).toMatchObject({ cumulative: 1300, status: "within" });
    expect(by.get("PERSUADE")).toMatchObject({ cumulative: 2100, status: "partial" }); // cap 1500 lands here
    expect(by.get("PROSPECT")?.status).toBe("beyond");
    expect(by.get(UNSCORED_KEY)?.status).toBe("beyond");
    expect(by.get("MOBILIZE")?.cumulativeCents).toBeCloseTo(600 * 2.48, 3);
  });

  it("uncapped → every row within; missing keys count as zero", () => {
    const rows = coverageRows({ MOBILIZE: 10 }, 2, null);
    expect(rows.every((r) => r.status === "within")).toBe(true);
    expect(rows.find((r) => r.key === "BANK")?.count).toBe(0);
    expect(rows[rows.length - 1].cumulative).toBe(10);
  });

  it("a cap exactly on a boundary keeps the boundary row within", () => {
    const rows = coverageRows({ MOBILIZE: 500, BANK: 500 }, 1, 500);
    expect(rows.find((r) => r.key === "MOBILIZE")?.status).toBe("within");
    expect(rows.find((r) => r.key === "BANK")?.status).toBe("beyond");
  });
});

describe("balanceCheck", () => {
  // 1-segment message at the toll-free planning rate with 5% replies:
  // 1.24¢ + 0.05 x 3.27¢ = 1.4035¢ per recipient.
  const perText = 1.24 + 0.05 * 3.27;

  it("reports how far a real Twilio balance stretches", () => {
    // The account balance that prompted this: $46.35.
    const b = balanceCheck({ balanceCents: 4635, perTextCents: perText, texts: 10000 });
    expect(b.affordable).toBe(3302);
    expect(b.covers).toBe(false);
    expect(b.coveragePct).toBeCloseTo(33.02, 1);
  });

  it("a covered send reports no shortfall and 100% coverage", () => {
    const b = balanceCheck({ balanceCents: 4635, perTextCents: perText, texts: 1000 });
    expect(b.covers).toBe(true);
    expect(b.shortfallCents).toBe(0);
    expect(b.coveragePct).toBe(100);
    expect(b.costCents).toBeCloseTo(1000 * perText, 6);
  });

  it("quantifies the shortfall when the blast outruns the balance", () => {
    const b = balanceCheck({ balanceCents: 1000, perTextCents: 2, texts: 1000 });
    expect(b.costCents).toBe(2000);
    expect(b.shortfallCents).toBe(1000);
    expect(b.affordable).toBe(500);
  });

  it("exact coverage counts as covered", () => {
    const b = balanceCheck({ balanceCents: 2000, perTextCents: 2, texts: 1000 });
    expect(b.covers).toBe(true);
    expect(b.affordable).toBe(1000);
  });

  it("never divides by a zero rate, and clamps junk inputs", () => {
    expect(balanceCheck({ balanceCents: 100, perTextCents: 0, texts: 50 })).toMatchObject({
      affordable: 50,
      covers: true,
      coveragePct: 100,
    });
    const neg = balanceCheck({ balanceCents: -5, perTextCents: 2, texts: -3 });
    expect(neg.affordable).toBe(0);
    expect(neg.costCents).toBe(0);
    expect(neg.coveragePct).toBe(100); // nothing intended → nothing uncovered
  });
});
