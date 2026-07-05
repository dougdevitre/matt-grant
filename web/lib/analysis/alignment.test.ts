import { describe, it, expect } from "vitest";
import { alignCandidate, analyzeField } from "@/lib/analysis/alignment";
import { ISSUE_AXES } from "@/lib/integrations/research/issues";
import type { Candidate } from "@/lib/integrations/research/candidates";
import type { Statement, Stance } from "@/lib/integrations/statements/types";

// Reference two real axes by id so the tests survive label/id wording changes.
const A0 = ISSUE_AXES[0].id;
const A1 = ISSUE_AXES[1].id;

const cand = (slug: string, name = slug) => ({ slug, name }) as unknown as Candidate;

const stmt = (
  candidateSlug: string,
  issueId: typeof A0,
  stance: Stance,
  retrievedAt: string,
  extra: Partial<Statement> = {},
): Statement => ({
  candidateSlug,
  issueId,
  stance,
  summary: `${stance} ${issueId}`,
  sourceUrl: "https://example.org/source",
  sourceType: "news",
  retrievedAt,
  ...extra,
});

describe("alignCandidate", () => {
  it("maps support→agree, oppose→differ, and mixed/unclear→differ (never overclaim common ground)", () => {
    const r = alignCandidate(cand("x"), [stmt("x", A0, "support", "2026-06-01"), stmt("x", A1, "oppose", "2026-06-01")]);
    expect(r.axes.find((a) => a.issueId === A0)!.verdict).toBe("agree");
    expect(r.axes.find((a) => a.issueId === A1)!.verdict).toBe("differ");
    expect(alignCandidate(cand("y"), [stmt("y", A0, "mixed", "2026-06-01")]).axes.find((a) => a.issueId === A0)!.verdict).toBe("differ");
    expect(alignCandidate(cand("z"), [stmt("z", A0, "unclear", "2026-06-01")]).axes.find((a) => a.issueId === A0)!.verdict).toBe("differ");
  });

  it("treats an axis with no sourced statement as unknown (no inference, null citation)", () => {
    const r = alignCandidate(cand("x"), [stmt("x", A0, "support", "2026-06-01")]);
    const a1 = r.axes.find((a) => a.issueId === A1)!;
    expect(a1.verdict).toBe("unknown");
    expect(a1.stance).toBeNull();
    expect(a1.sourceUrl).toBeNull();
  });

  it("uses the most recently retrieved statement when an axis has several", () => {
    const r = alignCandidate(cand("x"), [
      stmt("x", A0, "oppose", "2026-05-01", { sourceUrl: "https://old" }),
      stmt("x", A0, "support", "2026-06-20", { sourceUrl: "https://new" }),
    ]);
    const a0 = r.axes.find((a) => a.issueId === A0)!;
    expect(a0.verdict).toBe("agree");
    expect(a0.sourceUrl).toBe("https://new"); // carries the winning statement's citation
  });

  it("breaks a same-date tie by input order (first-listed wins), deterministically", () => {
    // Two sources captured the same day disagree on the axis. The tie must resolve
    // to the first-listed statement (stable order), not to sort internals — a
    // non-antisymmetric comparator here would silently flip the verdict.
    const first = alignCandidate(cand("x"), [
      stmt("x", A0, "oppose", "2026-06-01", { sourceUrl: "https://first" }),
      stmt("x", A0, "support", "2026-06-01", { sourceUrl: "https://second" }),
    ]).axes.find((a) => a.issueId === A0)!;
    expect(first.verdict).toBe("differ");
    expect(first.sourceUrl).toBe("https://first");

    // Reversing the input reverses the winner — proving the result tracks input
    // order, not an accident of the comparator.
    const reversed = alignCandidate(cand("x"), [
      stmt("x", A0, "support", "2026-06-01", { sourceUrl: "https://second" }),
      stmt("x", A0, "oppose", "2026-06-01", { sourceUrl: "https://first" }),
    ]).axes.find((a) => a.issueId === A0)!;
    expect(reversed.verdict).toBe("agree");
    expect(reversed.sourceUrl).toBe("https://second");
  });

  it("ignores other candidates' statements", () => {
    const r = alignCandidate(cand("x"), [stmt("other", A0, "support", "2026-06-01")]);
    expect(r.axes.find((a) => a.issueId === A0)!.verdict).toBe("unknown");
    expect(r.confidence).toBe(0);
  });

  it("computes bridges, contrasts, knownCount, score, and confidence", () => {
    const r = alignCandidate(cand("x"), [stmt("x", A0, "support", "2026-06-01"), stmt("x", A1, "oppose", "2026-06-01")]);
    expect(r.bridges).toEqual([A0]);
    expect(r.contrasts).toEqual([A1]);
    expect(r.knownCount).toBe(2);
    expect(r.score).toBe(0.5); // 1 agreement / 2 known
    expect(r.confidence).toBe(2);
    expect(r.unknowns.length).toBe(ISSUE_AXES.length - 2);
  });

  it("scores null when nothing is known (every axis unknown)", () => {
    const r = alignCandidate(cand("x"), []);
    expect(r.score).toBeNull();
    expect(r.knownCount).toBe(0);
    expect(r.unknowns.length).toBe(ISSUE_AXES.length);
  });
});

describe("analyzeField", () => {
  it("ranks coalition by bridges desc, then confidence desc; zero-known candidates sink", () => {
    const statements = [
      stmt("a", A0, "support", "2026-06-01"), // a: 2 bridges, confidence 2
      stmt("a", A1, "support", "2026-06-01"),
      stmt("b", A0, "support", "2026-06-01"), // b: 1 bridge, confidence 1
      stmt("c", A0, "support", "2026-06-01"), // c: 1 bridge, confidence 2
      stmt("c", A1, "oppose", "2026-06-01"),
    ];
    const f = analyzeField([cand("a"), cand("b"), cand("c"), cand("d")], statements, "2026-06-21T00:00:00Z");
    // a (2 bridges) > c (1 bridge, conf 2) > b (1 bridge, conf 1) > d (0)
    expect(f.coalitionRanking.map((r) => r.slug)).toEqual(["a", "c", "b", "d"]);
    expect(f.coalitionRanking[3]).toMatchObject({ slug: "d", bridges: 0 });
    expect(f.generatedAt).toBe("2026-06-21T00:00:00Z");
  });
});
