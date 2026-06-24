// Pure view-model for the "where they differ" contrast share card
// (rendered by /api/research/contrast-card). Kept JSX-free so the selection
// logic — which axes count as contrasts, the outside-money summary — is
// unit-testable without rendering an ImageResponse.

import type { CandidateAlignment } from "./alignment";
import { axis } from "../integrations/research/issues";
import { partyLabel, type Party } from "../integrations/research/candidates";
import type { FecDetail } from "../integrations/fec/types";

export type ContrastCardModel = {
  name: string;
  party: string;
  differCount: number;
  knownCount: number;
  contrasts: { label: string; matt: string; them: string | null }[];
  support: number | null;
  oppose: number | null;
};

export function cardModel(
  c: { name: string; party: Party },
  a: CandidateAlignment,
  detail: FecDetail | null,
): ContrastCardModel {
  const contrasts = a.axes
    .filter((x) => x.verdict === "differ")
    .map((x) => ({ label: x.label, matt: axis(x.issueId).mattSummary, them: x.summary }));
  const ie = detail?.ie;
  return {
    name: c.name,
    party: partyLabel(c.party),
    differCount: a.contrasts.length,
    knownCount: a.knownCount,
    contrasts,
    // Omit zeroes so the card never shows a hollow "$0 against".
    support: ie && ie.support > 0 ? ie.support : null,
    oppose: ie && ie.oppose > 0 ? ie.oppose : null,
  };
}
