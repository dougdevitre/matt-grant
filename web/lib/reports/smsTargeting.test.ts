import { describe, expect, it } from "vitest";
import { buildSendList, rankForBroadcast, recipientPriority, toSegment, type ScoredRecipient } from "./smsTargeting";

const r = (phone: string, over: Partial<ScoredRecipient> = {}): ScoredRecipient => ({ phone, ...over });

describe("toSegment", () => {
  it("validates consent-row segment strings, never trusts them", () => {
    expect(toSegment("MOBILIZE")).toBe("MOBILIZE");
    expect(toSegment("BANK")).toBe("BANK");
    for (const bad of ["mobilize", "ADMIN", "", undefined, null]) {
      expect(toSegment(bad as string | undefined | null), String(bad)).toBeUndefined();
    }
  });
});

describe("rankForBroadcast (the send-path ranking)", () => {
  const audience: ScoredRecipient[] = [
    r("+13145550006"), // unscored
    r("+13145550001", { segment: "MONITOR", t: 0 }),
    r("+13145550003", { segment: "MOBILIZE", t: 2 }),
    r("+13145550002", { segment: "BANK", t: 5 }),
    r("+13145550004", { segment: "PERSUADE", t: 4 }),
  ];

  it("orders highest-likelihood first and NEVER drops anyone without a cap", () => {
    const { ordered, capped, total } = rankForBroadcast(audience);
    expect(ordered.map((x) => x.segment ?? "unscored")).toEqual([
      "MOBILIZE", "BANK", "PERSUADE", "unscored", "MONITOR", // unscored floor (0.05) > MONITOR (0)
    ]);
    expect(ordered).toHaveLength(audience.length); // nobody silently dropped
    expect(capped).toBe(false);
    expect(total).toBe(5);
  });

  it("a cap trims only the lowest-priority tail and reports it", () => {
    const { ordered, capped } = rankForBroadcast(audience, 2);
    expect(ordered.map((x) => x.segment)).toEqual(["MOBILIZE", "BANK"]);
    expect(capped).toBe(true);
  });

  it("ignores nonsense caps and keeps a deterministic phone tie-break", () => {
    expect(rankForBroadcast(audience, 0).ordered).toHaveLength(5);
    expect(rankForBroadcast(audience, NaN).ordered).toHaveLength(5);
    const tie = rankForBroadcast([r("+2", { segment: "BANK", t: 3 }), r("+1", { segment: "BANK", t: 3 })]);
    expect(tie.ordered.map((x) => x.phone)).toEqual(["+1", "+2"]);
  });

  it("keeps the first-name merge field through the ranking", () => {
    const { ordered } = rankForBroadcast([r("+1", { segment: "MOBILIZE", first: "Jordan" })]);
    expect(ordered[0].first).toBe("Jordan");
  });
});

describe("recipientPriority", () => {
  it("orders by segment weight, with T only as a within-segment tie-break", () => {
    const mobilize = recipientPriority(r("+1", { segment: "MOBILIZE", t: 1 }));
    const bankHiT = recipientPriority(r("+2", { segment: "BANK", t: 5 }));
    const persuade = recipientPriority(r("+3", { segment: "PERSUADE", t: 5 }));
    const unscored = recipientPriority(r("+4"));
    // MOBILIZE (1.0) beats even a max-T BANK (0.8+): T never crosses a segment boundary.
    expect(mobilize).toBeGreaterThan(bankHiT);
    expect(bankHiT).toBeGreaterThan(persuade);
    expect(persuade).toBeGreaterThan(unscored);
    // Within BANK, higher T ranks first.
    expect(recipientPriority(r("+a", { segment: "BANK", t: 5 }))).toBeGreaterThan(
      recipientPriority(r("+b", { segment: "BANK", t: 2 })),
    );
  });
});

describe("buildSendList", () => {
  const audience: ScoredRecipient[] = [
    r("+13145550001", { segment: "MONITOR", t: 0 }),
    r("+13145550002", { segment: "BANK", t: 5 }),
    r("+13145550003", { segment: "MOBILIZE", t: 2 }),
    r("+13145550004", { segment: "PERSUADE", t: 4 }),
    r("+13145550005", { segment: "PROSPECT", t: 2 }),
    r("+13145550006"), // unscored
    r("+13145550007", { segment: "BANK", t: 4, banked: true }), // already voted
  ];

  it("ranks highest-value first and excludes MONITOR + unscored by default", () => {
    const list = buildSendList(audience);
    const order = list.selected.map((x) => x.segment ?? "UNSCORED");
    expect(order).toEqual(["MOBILIZE", "BANK", "BANK", "PERSUADE", "PROSPECT"]);
    // MONITOR (weight 0) and the unscored recipient are filtered out.
    expect(order).not.toContain("MONITOR");
    expect(order).not.toContain("UNSCORED");
    expect(list.droppedOffTarget).toBe(2);
  });

  it("GOTV mode: excludeBanked drops voters who already returned a ballot", () => {
    const list = buildSendList(audience, { excludeBanked: true });
    expect(list.droppedBanked).toBe(1);
    expect(list.selected.some((x) => x.banked)).toBe(false);
  });

  it("restricts to the requested segments", () => {
    const list = buildSendList(audience, { segments: ["MOBILIZE", "BANK"] });
    expect(new Set(list.selected.map((x) => x.segment))).toEqual(new Set(["MOBILIZE", "BANK"]));
  });

  it("caps to the budget, taking the top recipients by priority", () => {
    // Budget for exactly 2 sends at 2¢ (1 touch each) → the two highest-value.
    const list = buildSendList(audience, { budgetCents: 4, costPerSmsCents: 2, touches: 1 });
    expect(list.selected.map((x) => x.segment)).toEqual(["MOBILIZE", "BANK"]);
    expect(list.totalSends).toBe(2);
    expect(list.spendCents).toBe(4);
    expect(list.capped).toBe(true);
  });

  it("accounts for touches per recipient when applying the budget", () => {
    // Budget for 4 sends; at 2 touches/person that funds 2 recipients.
    const list = buildSendList(audience, { budgetCents: 8, costPerSmsCents: 2, touches: 2 });
    expect(list.selected).toHaveLength(2);
    expect(list.totalSends).toBe(4);
    expect(list.spendCents).toBe(8);
  });

  it("includeUnscored appends unscored opted-ins last (only if budget allows)", () => {
    const list = buildSendList(audience, { includeUnscored: true });
    expect(list.selected.map((x) => x.segment ?? "UNSCORED").at(-1)).toBe("UNSCORED");
  });

  it("is deterministic for equal priority (tie-break by phone)", () => {
    const tied = [r("+13145559999", { segment: "BANK", t: 3 }), r("+13145551111", { segment: "BANK", t: 3 })];
    expect(buildSendList(tied).selected.map((x) => x.phone)).toEqual(["+13145551111", "+13145559999"]);
  });
});
