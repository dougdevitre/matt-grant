// The four issue axes used for alignment scoring. Each maps to one of Matt's
// platform pillars (faithful to candidate/platform.md) and records Matt's own
// stance as "for". A candidate "agrees" with Matt on an axis when their SOURCED
// stance is "support". These ids match the /issues/<slug> pages (lib/issues.ts).

export type IssueId = "family-courts" | "term-limits" | "smaller-government" | "lower-taxes";

export type IssueAxis = {
  id: IssueId;
  label: string;
  // Matt's stance, faithful to platform.md. Used as the reference point for agreement.
  mattPosition: "for";
  // One-line statement of what "support" means on this axis (for scripts/UI).
  mattSummary: string;
};

export const ISSUE_AXES: IssueAxis[] = [
  {
    id: "family-courts",
    label: "Family-court reform",
    mattPosition: "for",
    mattSummary:
      "End corruption in the family court system — the CHILD Protection Act tying Title IV-D grant money to clean, accountable state courts.",
  },
  {
    id: "term-limits",
    label: "Term limits",
    mattPosition: "for",
    mattSummary: "Term limits for the House and Senate, with a grandfather clause so reform actually passes.",
  },
  {
    id: "smaller-government",
    label: "Smaller government",
    mattPosition: "for",
    mattSummary: "A leaner federal workforce via a hiring freeze and voluntary early-retirement packages.",
  },
  {
    id: "lower-taxes",
    label: "Lower taxes",
    mattPosition: "for",
    mattSummary: "Lower taxes funded by cutting fraud, waste, and headcount first — not gimmicks.",
  },
];

export const ISSUE_IDS = ISSUE_AXES.map((a) => a.id);

export function isIssueId(s: string): s is IssueId {
  return (ISSUE_IDS as string[]).includes(s);
}

export function axis(id: IssueId): IssueAxis {
  const a = ISSUE_AXES.find((x) => x.id === id);
  if (!a) throw new Error(`unknown issue axis: ${id}`);
  return a;
}
