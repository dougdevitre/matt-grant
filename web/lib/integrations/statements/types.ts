import type { IssueId } from "../research/issues";

// A candidate's SOURCED public position on one issue axis. This is where the
// "alignment" of non-incumbents (who have no federal voting record) actually
// lives. Every statement MUST carry a sourceUrl — no source, no statement.

export type Stance = "support" | "oppose" | "mixed" | "unclear";

export type SourceType = "campaign-site" | "press-release" | "news" | "questionnaire" | "vote" | "social" | "other";

export type Statement = {
  candidateSlug: string;
  issueId: IssueId;
  stance: Stance;
  summary: string; // neutral paraphrase of the SOURCED position (not a fabricated quote)
  quote?: string | null; // verbatim only — never paraphrased into quotation marks
  sourceUrl: string; // REQUIRED — primary source backing the stance
  sourceType: SourceType;
  retrievedAt: string; // ISO date the source was captured
};
