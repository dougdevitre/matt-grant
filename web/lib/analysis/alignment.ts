// Deterministic alignment analysis. Computes — from SOURCED statements only —
// where each candidate agrees with Matt, where they differ, and where their
// position is unknown. No source = "unknown", never an inference. The output is
// the substrate for the field matrix, coalition ranking, scripts, and graphics.

import { ISSUE_AXES, type IssueId, type IssueAxis } from "../integrations/research/issues";
import type { Candidate } from "../integrations/research/candidates";
import type { Statement, Stance } from "../integrations/statements/types";

export type Verdict = "agree" | "differ" | "unknown";

export type AxisAlignment = {
  issueId: IssueId;
  label: string;
  verdict: Verdict;
  stance: Stance | null; // candidate's sourced stance, if any
  summary: string | null; // from the backing statement
  sourceUrl: string | null; // citation — required on any non-unknown verdict
};

export type CandidateAlignment = {
  slug: string;
  name: string;
  axes: AxisAlignment[];
  bridges: IssueId[]; // axes where the candidate agrees with Matt
  contrasts: IssueId[]; // axes where they differ
  unknowns: IssueId[]; // no sourced stance
  knownCount: number; // axes with a sourced stance
  score: number | null; // agreements / knownCount, or null when nothing is known
  confidence: number; // count of sourced statements backing the picture
};

// Matt's position on every axis is "for" (support). A candidate AGREES when their
// sourced stance is "support"; DIFFERS on "oppose"; "mixed"/"unclear" count as
// known-but-not-agreement (differ-leaning) so we never overclaim common ground.
function verdictFor(stance: Stance): Verdict {
  if (stance === "support") return "agree";
  return "differ";
}

function latest(statements: Statement[]): Statement | null {
  if (statements.length === 0) return null;
  // Most recently retrieved source wins; stable for equal dates. localeCompare
  // returns 0 on a tie, so V8's stable sort keeps input order and the first-listed
  // same-date source wins deterministically. (The old `< ? 1 : -1` comparator never
  // returned 0 — not antisymmetric — so a same-date conflicting pair resolved by
  // sort internals, silently flipping a candidate's agree/differ verdict.)
  return [...statements].sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt))[0];
}

export function alignCandidate(candidate: Candidate, statements: Statement[]): CandidateAlignment {
  const own = statements.filter((s) => s.candidateSlug === candidate.slug);

  const axes: AxisAlignment[] = ISSUE_AXES.map((a: IssueAxis) => {
    const forAxis = own.filter((s) => s.issueId === a.id);
    const st = latest(forAxis);
    if (!st) {
      return { issueId: a.id, label: a.label, verdict: "unknown", stance: null, summary: null, sourceUrl: null };
    }
    return {
      issueId: a.id,
      label: a.label,
      verdict: verdictFor(st.stance),
      stance: st.stance,
      summary: st.summary,
      sourceUrl: st.sourceUrl,
    };
  });

  const bridges = axes.filter((x) => x.verdict === "agree").map((x) => x.issueId);
  const contrasts = axes.filter((x) => x.verdict === "differ").map((x) => x.issueId);
  const unknowns = axes.filter((x) => x.verdict === "unknown").map((x) => x.issueId);
  const knownCount = bridges.length + contrasts.length;

  return {
    slug: candidate.slug,
    name: candidate.name,
    axes,
    bridges,
    contrasts,
    unknowns,
    knownCount,
    score: knownCount === 0 ? null : bridges.length / knownCount,
    confidence: own.length,
  };
}

export type FieldAnalysis = {
  generatedAt: string;
  candidates: CandidateAlignment[];
  // Coalition priority: most common ground first, weighted by how much we actually
  // know (confidence). Candidates with zero known stances sink to the bottom.
  coalitionRanking: { slug: string; name: string; bridges: number; confidence: number; score: number | null }[];
};

export function analyzeField(
  candidates: Candidate[],
  statements: Statement[],
  generatedAt: string,
): FieldAnalysis {
  const aligned = candidates.map((c) => alignCandidate(c, statements));
  const coalitionRanking = [...aligned]
    .map((a) => ({ slug: a.slug, name: a.name, bridges: a.bridges.length, confidence: a.confidence, score: a.score }))
    .sort((x, y) => y.bridges - x.bridges || y.confidence - x.confidence);
  return { generatedAt, candidates: aligned, coalitionRanking };
}
