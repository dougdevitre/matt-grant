import { describe, it, expect } from "vitest";
import { APPEARANCE_OPPORTUNITIES, getOpportunity, opportunityToEventInput } from "./opportunities";
import { isEventType } from "./types";

describe("APPEARANCE_OPPORTUNITIES catalog", () => {
  it("is non-empty and every slug is unique", () => {
    expect(APPEARANCE_OPPORTUNITIES.length).toBeGreaterThan(0);
    const slugs = APPEARANCE_OPPORTUNITIES.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  // The project's compliance rule: no uncited data. Every entry must carry a
  // real source link and a verify date, and a valid event type.
  it("every entry has a sourceUrl, a verifiedAt date, and a valid event type", () => {
    for (const o of APPEARANCE_OPPORTUNITIES) {
      expect(o.sourceUrl, o.slug).toMatch(/^https?:\/\//);
      expect(o.verifiedAt, o.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(isEventType(o.suggestedType), o.slug).toBe(true);
      expect(o.name.trim().length, o.slug).toBeGreaterThan(0);
      expect([1, 2, 3], o.slug).toContain(o.priority);
    }
  });
});

describe("opportunityToEventInput", () => {
  const opp = getOpportunity("jefferson-county-fair")!;

  it("produces a DRAFT event prefilled from the opportunity", () => {
    const input = opportunityToEventInput(opp, { createdBy: "a@x.test", start: "2026-07-15T17:00:00.000Z" });
    expect(input.status).toBe("DRAFT");
    expect(input.source).toBe("manual");
    expect(input.title).toBe(opp.name);
    expect(input.type).toBe(opp.suggestedType);
    expect(input.location.city).toBe(opp.city);
    expect(input.location.county).toBe(opp.county);
    expect(input.start).toBe("2026-07-15T17:00:00.000Z");
    expect(input.createdBy).toBe("a@x.test");
    // curated priority carried over as a manual override
    expect(input.priority).toBe(opp.priority);
    expect(input.priorityManual).toBe(true);
  });

  it("carries the cited source + a verify-the-date reminder into the description", () => {
    const input = opportunityToEventInput(opp, { createdBy: "a@x.test", start: "2026-07-15T17:00:00.000Z" });
    expect(input.description).toContain(opp.sourceUrl);
    expect(input.description).toMatch(/confirm 2026 dates/i);
    expect(input.description).toMatch(/set the real date/i);
  });
});
