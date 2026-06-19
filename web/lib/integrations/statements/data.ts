import type { Statement, Stance, SourceType } from "./types";
import { isIssueId } from "../research/issues";

// Curated, sourced candidate positions. Ships EMPTY by design: we never
// fabricate a candidate's stance. The campaign populates this from public
// primary sources — either by editing SEED_STATEMENTS below (each entry needs a
// real sourceUrl) or via RESEARCH_STATEMENTS_JSON for ops-driven curation.
//
// Example shape (do NOT commit a fabricated stance — replace with a real,
// sourced entry before use):
//   {
//     candidateSlug: "incumbent-mo02",
//     issueId: "term-limits",
//     stance: "support",
//     summary: "Cosponsored a House term-limits resolution.",
//     sourceUrl: "https://www.congress.gov/bill/119th-congress/house-joint-resolution/XX",
//     sourceType: "vote",
//     retrievedAt: "2026-06-18",
//   }
const SEED_STATEMENTS: Statement[] = [];

function parseStatementsJson(raw: string): Statement[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map((s) => ({
        candidateSlug: String(s.candidateSlug ?? ""),
        issueId: String(s.issueId ?? ""),
        stance: (s.stance as Stance) ?? "unclear",
        summary: String(s.summary ?? ""),
        quote: (s.quote as string) ?? null,
        sourceUrl: String(s.sourceUrl ?? ""),
        sourceType: (s.sourceType as SourceType) ?? "other",
        retrievedAt: String(s.retrievedAt ?? ""),
      }))
      // Hard guardrails: must reference a known axis AND carry a source URL.
      .filter((s) => s.candidateSlug && isIssueId(s.issueId) && s.sourceUrl)
      .map((s) => ({ ...s, issueId: s.issueId as Statement["issueId"] }));
  } catch {
    return [];
  }
}

export function loadStatements(): Statement[] {
  const fromEnv = process.env.RESEARCH_STATEMENTS_JSON
    ? parseStatementsJson(process.env.RESEARCH_STATEMENTS_JSON)
    : [];
  return [...SEED_STATEMENTS.filter((s) => s.sourceUrl), ...fromEnv];
}

export function statementsFor(slug: string): Statement[] {
  return loadStatements().filter((s) => s.candidateSlug === slug);
}
