import { describe, it, expect } from "vitest";
import { scoreText, rankByFamilyCourtRelevance } from "@/lib/analysis/childAct";

describe("CHILD Act relevance — scoreText", () => {
  it("scores a Title IV-D / child-support bill as core", () => {
    const r = scoreText("Title IV-D Child Support Enforcement Improvement Act", "Families");
    expect(r.tier).toBe("core");
    expect(r.matched).toContain("title iv-d");
    expect(r.score).toBeGreaterThanOrEqual(3);
  });

  it("matches family-court terms regardless of separator or case", () => {
    expect(scoreText("Reforming the FAMILY COURT system").tier).toBe("core");
    expect(scoreText("guardian-ad-litem accountability").matched).toContain("guardian ad litem");
  });

  it("treats general child-welfare framing as related, not core", () => {
    const r = scoreText("Child Welfare Modernization Act");
    expect(r.tier).toBe("related");
  });

  it("does not fire on words that merely contain a term", () => {
    expect(scoreText("Childersburg Land Conveyance Act").score).toBe(0);
    expect(scoreText("Minority Business Development Act").score).toBe(0);
  });

  it("does not double-count a token already inside a matched phrase", () => {
    // "child support" should not additionally award the bare "child".
    const r = scoreText("Child Support Recovery Act");
    expect(r.matched).toContain("child support");
    expect(r.matched).not.toContain("child");
    expect(r.score).toBe(3);
  });

  it("returns a null tier and empty match for an unrelated bill", () => {
    const r = scoreText("National Defense Authorization Act", "Armed Forces and National Security");
    expect(r.score).toBe(0);
    expect(r.tier).toBeNull();
    expect(r.matched).toEqual([]);
  });
});

describe("CHILD Act relevance — rankByFamilyCourtRelevance", () => {
  const bills = [
    { title: "Title IV-D Child Support Enforcement Act", policyArea: "Families", sourceUrl: "https://congress.gov/a" },
    { title: "Child Welfare Funding Act", policyArea: "Families", sourceUrl: "https://congress.gov/b" },
    { title: "Highway Reauthorization Act", policyArea: "Transportation", sourceUrl: "https://congress.gov/c" },
    { title: "Family Court Transparency Act", policyArea: "Law", sourceUrl: null }, // no citation
  ];

  it("keeps only cited, relevant bills, ranked by score", () => {
    const ranked = rankByFamilyCourtRelevance(bills);
    expect(ranked.map((b) => b.title)).toEqual([
      "Title IV-D Child Support Enforcement Act",
      "Child Welfare Funding Act",
    ]);
    expect(ranked[0].relevance.score).toBeGreaterThanOrEqual(ranked[1].relevance.score);
  });

  it("drops a relevant bill that lacks a source URL (no citation, no claim)", () => {
    const ranked = rankByFamilyCourtRelevance(bills);
    expect(ranked.find((b) => b.title === "Family Court Transparency Act")).toBeUndefined();
  });
});
