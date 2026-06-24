import { describe, it, expect } from "vitest";
import { suggestPriority, PRIORITY_LABEL, PRIORITY_BADGE } from "./priority";

describe("suggestPriority", () => {
  it("a district-wide parade is Priority 1 (type + reach + earned media)", () => {
    const s = suggestPriority({ type: "parade", districtKey: "district:mo-02" });
    expect(s.tier).toBe(1);
    expect(s.reasons).toContain("Earned-media potential");
    expect(s.reasons).toContain("District-wide reach");
  });

  it("a county-level fundraiser is Priority 2", () => {
    expect(suggestPriority({ type: "fundraiser", districtKey: "county:099" }).tier).toBe(2);
  });

  it("a place-level meet-greet is Priority 3", () => {
    expect(suggestPriority({ type: "meet-greet", districtKey: "place:chesterfield" }).tier).toBe(3);
  });

  it("an internal canvass with no reach is Priority 3 with a reason", () => {
    const s = suggestPriority({ type: "canvass", districtKey: "place:ballwin" });
    expect(s.tier).toBe(3);
    expect(s.reasons.length).toBeGreaterThan(0);
  });

  it("labels and badges cover all three tiers", () => {
    for (const t of [1, 2, 3] as const) {
      expect(PRIORITY_LABEL[t]).toBeTruthy();
      expect(PRIORITY_BADGE[t]).toMatch(/bg-/);
    }
  });
});
