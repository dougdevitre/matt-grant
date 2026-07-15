import { describe, expect, it } from "vitest";
import { donateHref, LADDER, ladderTierForCents, nextRung, quickPickAmounts } from "./donorLadder";

describe("LADDER invariants", () => {
  it("is sorted ascending with unique thresholds and the FEC-max top rungs", () => {
    for (let i = 1; i < LADDER.length; i++) {
      expect(LADDER[i].amountCents).toBeGreaterThan(LADDER[i - 1].amountCents);
    }
    // Top rungs must match the verified 2025-26 limits ($3,500/election; $7,000 cycle).
    expect(LADDER.at(-2)?.amountCents).toBe(3500_00);
    expect(LADDER.at(-1)?.amountCents).toBe(7000_00);
    expect(LADDER.at(-2)?.note).toMatch(/per-election maximum/);
    expect(LADDER.at(-1)?.note).toMatch(/general/);
  });
});

describe("ladderTierForCents", () => {
  it("returns the highest rung reached, null below the first", () => {
    expect(ladderTierForCents(0)).toBeNull();
    expect(ladderTierForCents(24_99)).toBeNull();
    expect(ladderTierForCents(25_00)?.name).toBe("Front Porch Friend");
    expect(ladderTierForCents(49_99)?.name).toBe("Front Porch Friend");
    expect(ladderTierForCents(250_00)?.name).toBe("Precinct Partner");
    expect(ladderTierForCents(3500_00)?.name).toBe("Primary Champion");
    expect(ladderTierForCents(7000_00)?.name).toBe("Full-Cycle Champion");
    expect(ladderTierForCents(9999_99)?.name).toBe("Full-Cycle Champion");
  });
});

describe("donateHref", () => {
  const BASE = "https://secure.winred.com/x/donate-today?sc=winred-directory&money_bomb=false";

  it("sets amount on a base that already has a query string, without duplicating params", () => {
    const href = donateHref(BASE, 3500_00);
    const u = new URL(href);
    expect(u.searchParams.get("amount")).toBe("3500");
    expect(u.searchParams.get("sc")).toBe("winred-directory"); // preserved when not overridden
    expect(u.searchParams.get("money_bomb")).toBe("false");
    expect(href.match(/amount=/g)).toHaveLength(1);
  });

  it("overrides sc for per-surface attribution and formats non-whole deltas", () => {
    const u = new URL(donateHref(BASE, 150_00, "email-next-level"));
    expect(u.searchParams.get("sc")).toBe("email-next-level");
    expect(u.searchParams.get("amount")).toBe("150");
    expect(new URL(donateHref(BASE, 62_50, "web-ladder")).searchParams.get("amount")).toBe("62.50");
  });

  it("works on a bare base with no query string", () => {
    const u = new URL(donateHref("https://secure.winred.com/x/donate-today", 25_00, "letter-supporter-levels"));
    expect(u.searchParams.get("amount")).toBe("25");
    expect(u.searchParams.get("sc")).toBe("letter-supporter-levels");
  });
});

describe("quickPickAmounts", () => {
  it("derives the picker amounts from the LADDER, excluding the FEC-max rungs", () => {
    const picks = quickPickAmounts();
    // The six entry rungs — every LADDER rung WITHOUT a limit note, in dollars.
    expect(picks).toEqual([25, 50, 100, 250, 500, 1000]);
    // Never surface the two FEC-max recognition ceilings as one-tap buttons.
    expect(picks).not.toContain(3500);
    expect(picks).not.toContain(7000);
  });

  it("stays in sync with the LADDER (no hand-maintained list)", () => {
    const derived = LADDER.filter((r) => !r.note).map((r) => r.amountCents / 100);
    expect(quickPickAmounts()).toEqual(derived);
  });
});

describe("nextRung", () => {
  it("returns the next threshold, null at/above the top", () => {
    expect(nextRung(0)?.amountCents).toBe(25_00);
    expect(nextRung(25_00)?.amountCents).toBe(50_00);
    expect(nextRung(6999_99)?.amountCents).toBe(7000_00);
    expect(nextRung(7000_00)).toBeNull();
  });
});
