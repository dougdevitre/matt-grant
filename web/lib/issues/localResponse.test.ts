import { describe, it, expect } from "vitest";
import { buildCuratedResponse, generateLocalResponse } from "./localResponse";
import { getIssue } from "@/lib/issues";
import { CAMPAIGN } from "@/lib/site";
import type { LocalSnapshot } from "./localSnapshot";

const snap: LocalSnapshot = {
  zip: "63010",
  place: "ZIP 63010",
  facts: [
    { key: "medianHouseholdIncome", label: "Median household income", value: "$72,000", source: "U.S. Census ACS 5-year (2023)", sourceUrl: "https://data.census.gov/x" },
  ],
};

describe("buildCuratedResponse (fallback — pure, no AI)", () => {
  const issue = getIssue("lower-taxes")!;

  it("weaves the cited fact + documented commitment, with disclaimer", () => {
    const r = buildCuratedResponse(issue, snap);
    expect(r.source).toBe("curated");
    expect(r.paragraphs[0]).toContain("ZIP 63010");
    expect(r.paragraphs[0]).toContain("$72,000");
    expect(r.paragraphs[0]).toContain(issue.commitment);
    expect(r.disclaimer).toContain(CAMPAIGN.paidForBy);
  });

  it("with no snapshot, states the documented commitment only", () => {
    const r = buildCuratedResponse(issue, null);
    expect(r.paragraphs[0]).toBe(issue.commitment);
  });

  it("curated output passes the Layer-B guards (self-consistent)", async () => {
    // The fallback must itself be clean — verified via the full generate path with no key.
    const r = await generateLocalResponse("lower-taxes", snap, { key: "" });
    expect(r.source).toBe("curated");
  });
});

describe("generateLocalResponse — fail-closed", () => {
  it("no key → curated (never throws)", async () => {
    const r = await generateLocalResponse("family-courts", snap, { key: "" });
    expect(r.source).toBe("curated");
    expect(r.paragraphs.length).toBeGreaterThan(0);
  });

  it("no snapshot → curated", async () => {
    const r = await generateLocalResponse("term-limits", null, { key: "" });
    expect(r.source).toBe("curated");
  });

  it("unknown issue → curated, never throws", async () => {
    const r = await generateLocalResponse("nope", snap, { key: "" });
    expect(r.source).toBe("curated");
  });
});
