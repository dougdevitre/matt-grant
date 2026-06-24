import { describe, it, expect } from "vitest";
import { cardModel } from "./contrastCard";
import type { CandidateAlignment } from "./alignment";
import type { FecDetail } from "../integrations/fec/types";

const align = (over: Partial<CandidateAlignment> = {}): CandidateAlignment => ({
  slug: "x",
  name: "Test Candidate",
  axes: [
    { issueId: "term-limits", label: "Term limits", verdict: "differ", stance: "oppose", summary: "Opposes them", sourceUrl: "https://s/1" },
    { issueId: "lower-taxes", label: "Lower taxes", verdict: "agree", stance: "support", summary: "For cuts", sourceUrl: "https://s/2" },
    { issueId: "smaller-government", label: "Smaller government", verdict: "unknown", stance: null, summary: null, sourceUrl: null },
    { issueId: "family-courts", label: "Family-court reform", verdict: "differ", stance: "oppose", summary: "No reform", sourceUrl: "https://s/3" },
  ],
  bridges: ["lower-taxes"],
  contrasts: ["term-limits", "family-courts"],
  unknowns: ["smaller-government"],
  knownCount: 3,
  score: 1 / 3,
  confidence: 3,
  ...over,
});

describe("cardModel", () => {
  it("selects only the 'differ' axes as contrasts, with Matt's reference summary", () => {
    const m = cardModel({ name: "Test Candidate", party: "R" }, align(), null);
    expect(m.differCount).toBe(2);
    expect(m.contrasts.map((c) => c.label)).toEqual(["Term limits", "Family-court reform"]);
    // Matt's own pillar summary is attached for the card body (not the opponent's quote).
    expect(m.contrasts[0].matt).toMatch(/term limits/i);
    expect(m.contrasts[0].them).toBe("Opposes them");
    expect(m.party).toBe("Republican");
  });

  it("includes outside-money totals only when positive", () => {
    const detail = { ie: { support: 5000, oppose: 0, topSpenders: [] } } as unknown as FecDetail;
    const m = cardModel({ name: "T", party: "D" }, align(), detail);
    expect(m.support).toBe(5000);
    expect(m.oppose).toBeNull(); // zero is omitted, not shown as "$0 against"
  });

  it("omits the money line entirely when no FEC detail is available", () => {
    const m = cardModel({ name: "T", party: "R" }, align(), null);
    expect(m.support).toBeNull();
    expect(m.oppose).toBeNull();
  });

  it("handles a candidate with no sourced disagreements", () => {
    const noDiff = align({
      axes: [{ issueId: "lower-taxes", label: "Lower taxes", verdict: "agree", stance: "support", summary: "For", sourceUrl: "https://s" }],
      contrasts: [],
    });
    const m = cardModel({ name: "T", party: "R" }, noDiff, null);
    expect(m.differCount).toBe(0);
    expect(m.contrasts).toEqual([]);
  });
});
