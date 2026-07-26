// Single source of truth for the primary + early-vote calendar, shared by SMS,
// the vote agent, and email so the two channels can never drift. Dates are from
// candidate/absentee-voting-guide.md (verified 2026-06-24, re-checked 2026-07-10):
// no-excuse in-person July 21 – 5pm Aug 3; by-mail application received by 5pm Wed
// July 22; Election Day Aug 4, polls 6am–7pm. Neutral module (only imports site),
// so both lib/sms/* and lib/email/* can use it without cross-domain coupling.
import { CAMPAIGN } from "@/lib/site";

export const EARLY_VOTE_OPENS = "2026-07-21T00:00:00-05:00"; // Tue Jul 21 (Central)
export const EARLY_VOTE_ENDS = "2026-08-03T17:00:00-05:00"; // 5pm Mon Aug 3
export const MAIL_APP_DEADLINE = "2026-07-22T17:00:00-05:00"; // 5pm Wed Jul 22

/** Calendar-aware early-vote clause, completing "Early voting …". */
export function earlyVotePhrase(now: Date = new Date()): string {
  const t = now.getTime();
  if (t < new Date(EARLY_VOTE_OPENS).getTime()) return "starts Tue July 21 and runs through 5pm Mon Aug 3";
  if (t <= new Date(EARLY_VOTE_ENDS).getTime()) return "is open now through 5pm Mon Aug 3";
  return "has ended - vote on Election Day, Tue Aug 4, 6am-7pm";
}

/** Compact early-vote clause for SMS, completing "Vote early …".
 *  Same calendar awareness as earlyVotePhrase(), but short enough that the body
 *  plus the 62-character compliance suffix still fits ONE 160-char segment — a
 *  second segment doubles the cost of an entire blast. */
export function earlyVotePhraseShort(now: Date = new Date()): string {
  const t = now.getTime();
  if (t < new Date(EARLY_VOTE_OPENS).getTime()) return "starting Tue July 21";
  if (t <= new Date(EARLY_VOTE_ENDS).getTime()) return "through 5pm Mon Aug 3";
  return "has ended - vote Tue Aug 4, 6am-7pm";
}

/** True while the by-mail application deadline (5pm Wed Jul 22) is still in the future. */
export function mailDeadlineLive(now: Date = new Date()): boolean {
  return now.getTime() <= new Date(MAIL_APP_DEADLINE).getTime();
}

/** Whole days from `now` until the primary (CAMPAIGN.electionDate), floored at 0, so a
 *  countdown fills in automatically and staff never type (or fat-finger) the number. */
export function daysUntilElection(now: Date = new Date()): number {
  const ms = new Date(CAMPAIGN.electionDate).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Central-time calendar date (YYYY-MM-DD) — the campaign operates on CT, and a
 *  UTC date flips over at 7pm CT, which is exactly when GOTV copy matters most. */
function ctDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** True on Mon Aug 3 — the last day to vote early, closing at 5pm. */
export function isLastEarlyVoteDay(now: Date = new Date()): boolean {
  return ctDate(now) === "2026-08-03";
}

/** True on Tue Aug 4 — Election Day, polls 6am-7pm. */
export function isElectionDay(now: Date = new Date()): boolean {
  return ctDate(now) === "2026-08-04";
}
