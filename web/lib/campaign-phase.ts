// Where the campaign is in time, derived from the election date. Pure and
// time-injected (caller passes `nowMs`) so it's deterministic and testable, and
// so the server can compute it once and hand the result to client components
// without a hydration mismatch.
//
//   campaign — business as usual; fundraising is the primary ask
//   gotv     — final stretch (≤ GOTV_WINDOW_DAYS); turnout becomes the ask
//   past     — election day has passed

export const GOTV_WINDOW_DAYS = 14;

export type CampaignPhase = "campaign" | "gotv" | "past";
export type PhaseInfo = { phase: CampaignPhase; daysUntil: number };

const DAY_MS = 86_400_000;

export function campaignPhase(nowMs: number, electionIso: string): PhaseInfo {
  const target = new Date(electionIso).getTime();
  // Round up so the morning of election day still reads "1 day", not "0".
  const daysUntil = Math.ceil((target - nowMs) / DAY_MS);
  const phase: CampaignPhase = daysUntil <= 0 ? "past" : daysUntil <= GOTV_WINDOW_DAYS ? "gotv" : "campaign";
  return { phase, daysUntil };
}
