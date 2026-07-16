import { describe, expect, it } from "vitest";
import { allocateBudget, buildCohorts, emptySeg, renderReport, SMS_PRIORITY, type ReachCohorts } from "./twilioFund";

describe("buildCohorts", () => {
  it("counts each opted-in phone once, by segment, and derives unmatched", () => {
    const optedIn = new Set(["+13145550001", "+13145550002", "+13145550003", "+13145550004"]);
    const c = buildCohorts({
      optedIn,
      optedOut: 2,
      matched: [
        { segment: "MOBILIZE", phone: "+13145550001" },
        { segment: "MOBILIZE", phone: "+13145550001" }, // dup phone — counted once
        { segment: "BANK", phone: "+13145550002" },
        { segment: "PERSUADE", phone: "+19998887777" }, // not opted-in — ignored
      ],
      universe: { ...emptySeg(), MOBILIZE: 100, BANK: 50 },
    });
    expect(c.optedIn).toBe(4);
    expect(c.matched.MOBILIZE).toBe(1);
    expect(c.matched.BANK).toBe(1);
    expect(c.matched.PERSUADE).toBe(0);
    // 4 opted-in, 2 distinct matched → 2 unmatched
    expect(c.unmatched).toBe(2);
  });
});

const cohorts = (matched: Partial<Record<string, number>>): ReachCohorts => ({
  optedIn: 999,
  optedOut: 0,
  matched: { ...emptySeg(), ...(matched as Record<string, number>) },
  unmatched: 0,
  universe: emptySeg(),
});

describe("renderReport", () => {
  const cohorts: ReachCohorts = {
    optedIn: 4200,
    optedOut: 180,
    matched: { ...emptySeg(), MOBILIZE: 620, BANK: 900, PERSUADE: 780, PROSPECT: 240, MONITOR: 60 },
    unmatched: 1600,
    universe: { ...emptySeg(), MOBILIZE: 2551, BANK: 10029, PERSUADE: 393044, PROSPECT: 111086, MONITOR: 60656 },
  };
  const plan = allocateBudget(cohorts, { budgetCents: 2000_00, costPerSmsCents: 2 });
  const md = renderReport(cohorts, plan, { costPerSmsCents: 2, generatedAt: "2026-07-16", source: "table matt-grant" });

  it("renders the summary counts and a markdown table with one row per segment + a total", () => {
    expect(md).toContain("Opted-in (textable) numbers:** 4,200");
    expect(md).toContain("opted-in but unmatched:** 1,600");
    // A header row and a data row for each segment, plus a Total row.
    expect(md).toContain("| Segment | Opted-in & matched |");
    for (const seg of ["MOBILIZE", "BANK", "PERSUADE", "PROSPECT", "MONITOR"]) expect(md).toContain(`| ${seg} |`);
    expect(md).toContain("| **Total** |");
    // The generation stamp + cost assumption ride along.
    expect(md).toContain("2026-07-16");
    expect(md).toContain("$0.02");
  });

  it("emits COUNTS ONLY — never a phone number or an E.164 string (no PII)", () => {
    expect(md).not.toMatch(/\+1\d{10}/); // no E.164 numbers
    expect(md).not.toMatch(/\b\d{3}[-.]\d{3}[-.]\d{4}\b/); // no formatted phone numbers
  });
});

describe("allocateBudget", () => {
  const touches = { MOBILIZE: 4, BANK: 3, PERSUADE: 2, PROSPECT: 1, MONITOR: 0 };

  it("never funds MONITOR and funds in priority order", () => {
    const plan = allocateBudget(cohorts({ MOBILIZE: 10, BANK: 10, MONITOR: 999 }), {
      budgetCents: 1_000_00,
      costPerSmsCents: 2,
      touches,
    });
    const row = (s: string) => plan.rows.find((r) => r.segment === s)!;
    expect(row("MONITOR").sends).toBe(0);
    // Ample budget: MOBILIZE (10×4) and BANK (10×3) fully funded.
    expect(row("MOBILIZE").sends).toBe(40);
    expect(row("BANK").sends).toBe(30);
    expect(row("MOBILIZE").funded).toBe("full");
  });

  it("respects the budget cap with a partial last segment, in priority order", () => {
    // Budget only covers 50 sends at 2¢ = $1.00. MOBILIZE wants 40 (funded full),
    // BANK wants 30 but only 10 sends of budget remain (partial); PERSUADE none.
    const plan = allocateBudget(cohorts({ MOBILIZE: 10, BANK: 10, PERSUADE: 10 }), {
      budgetCents: 100,
      costPerSmsCents: 2,
      touches,
    });
    const row = (s: string) => plan.rows.find((r) => r.segment === s)!;
    expect(row("MOBILIZE").sends).toBe(40);
    expect(row("MOBILIZE").funded).toBe("full");
    expect(row("BANK").sends).toBe(10);
    expect(row("BANK").funded).toBe("partial");
    expect(row("PERSUADE").sends).toBe(0);
    expect(plan.totalSends).toBe(50);
    expect(plan.totalSpendCents).toBe(100);
    expect(plan.leftoverCents).toBe(0);
  });

  it("reports leftover budget when the audience is smaller than the budget", () => {
    const plan = allocateBudget(cohorts({ MOBILIZE: 1 }), { budgetCents: 1_000_00, costPerSmsCents: 2, touches });
    expect(plan.totalSends).toBe(4); // 1 person × 4 touches
    expect(plan.totalSpendCents).toBe(8);
    expect(plan.leftoverCents).toBe(1_000_00 - 8);
  });

  it("orders priorities MOBILIZE > BANK > PERSUADE > PROSPECT > MONITOR", () => {
    expect(SMS_PRIORITY.MOBILIZE).toBeGreaterThan(SMS_PRIORITY.BANK);
    expect(SMS_PRIORITY.BANK).toBeGreaterThan(SMS_PRIORITY.PERSUADE);
    expect(SMS_PRIORITY.PERSUADE).toBeGreaterThan(SMS_PRIORITY.PROSPECT);
    expect(SMS_PRIORITY.MONITOR).toBe(0);
  });
});
