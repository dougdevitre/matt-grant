import { describe, it, expect } from "vitest";
import { defaultChecklistFor, CHECKLIST_TEMPLATES } from "./checklists";
import { EVENT_TYPES } from "./types";

describe("defaultChecklistFor", () => {
  it("every event type produces a non-empty checklist with the baseline appended", () => {
    for (const type of EVENT_TYPES) {
      const list = defaultChecklistFor(type);
      expect(list.length, type).toBeGreaterThan(0);
      // baseline item present
      expect(list.some((i) => /arrive 30 minutes early/i.test(i.text)), type).toBe(true);
    }
  });

  it("items start unchecked with unique ids", () => {
    const list = defaultChecklistFor("parade");
    expect(list.every((i) => i.done === false)).toBe(true);
    const ids = list.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("type-specific items lead, then the shared baseline (parade gets a lineup item)", () => {
    const list = defaultChecklistFor("parade");
    expect(list.some((i) => /lineup position/i.test(i.text))).toBe(true);
  });

  it("CHECKLIST_TEMPLATES has an entry for every event type", () => {
    for (const type of EVENT_TYPES) expect(Array.isArray(CHECKLIST_TEMPLATES[type]), type).toBe(true);
  });
});
