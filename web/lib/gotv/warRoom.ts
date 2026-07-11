// GOTV war-room math (workflows/gotv-plan.md rendered live): countdown helpers,
// the GOTV timeline, and the 4-3-2-1 contact schedule — all pure so the page
// can stamp "today" once and every marker is testable. The timeline actions and
// contact messages are VERBATIM from workflows/gotv-plan.md — this module adds
// only countdown status, never new advice.

export const KEY_DATES = {
  earlyVoteStart: "2026-07-21", // no-excuse in-person absentee opens (poll-coverage-plan §2)
  earlyVoteEnd: "2026-08-03",
  electionDay: "2026-08-04", // = CAMPAIGN.electionDate (site.ts) — Missouri primary
} as const;

/** Whole calendar days from today until date (both YYYY-MM-DD); negative = past. */
export function daysUntil(dateISO: string, todayISO: string): number {
  const ms = Date.UTC(
    Number(dateISO.slice(0, 4)), Number(dateISO.slice(5, 7)) - 1, Number(dateISO.slice(8, 10)),
  ) - Date.UTC(
    Number(todayISO.slice(0, 4)), Number(todayISO.slice(5, 7)) - 1, Number(todayISO.slice(8, 10)),
  );
  return Math.round(ms / 86_400_000);
}

// The GOTV Timeline table (gotv-plan.md §GOTV Timeline), verbatim actions.
// maxDaysOut/minDaysOut bound each row's window in days-before-election-day.
export type TimelineRow = { when: string; action: string; maxDaysOut: number; minDaysOut: number };
export const GOTV_TIMELINE: TimelineRow[] = [
  { when: "6-8 weeks out", action: "Finalize GOTV universe; begin recruiting GOTV volunteers", maxDaysOut: 56, minDaysOut: 43 },
  { when: "4 weeks out", action: "Begin absentee chase (if applicable); confirm GOTV volunteer commitments", maxDaysOut: 42, minDaysOut: 15 },
  { when: "2 weeks out", action: "Begin early vote chase; finalize election day plan; print GOTV materials", maxDaysOut: 14, minDaysOut: 8 },
  { when: "1 week out", action: "Confirm all volunteers; finalize turf packets and walk lists; set up command center", maxDaysOut: 7, minDaysOut: 5 },
  { when: "4 days out", action: "Begin 4-3-2-1 contact schedule", maxDaysOut: 4, minDaysOut: 1 },
  { when: "Election day", action: "Execute election day operations; knock and drag; ride to polls", maxDaysOut: 0, minDaysOut: 0 },
];

export type TimelineStatus = "done" | "current" | "upcoming";

/** Status per timeline row for a given days-to-election count. */
export function timelineStatus(daysToElection: number): TimelineStatus[] {
  return GOTV_TIMELINE.map((r) => {
    if (daysToElection > r.maxDaysOut) return "upcoming";
    if (daysToElection < r.minDaysOut) return "done";
    return "current";
  });
}

// The 4-3-2-1 Contact Schedule (gotv-plan.md), verbatim.
export type ContactRound = { daysOut: number; label: string; contact: string; method: string; message: string };
export const CONTACT_SCHEDULE: ContactRound[] = [
  { daysOut: 4, label: "4 days", contact: "First GOTV contact", method: "Phone call or text", message: "Election is Tuesday. Here is your polling location and hours." },
  { daysOut: 3, label: "3 days", contact: "Second GOTV contact", method: "Door knock or phone", message: "Are you planning to vote? Do you know where to go?" },
  { daysOut: 2, label: "2 days", contact: "Third GOTV contact", method: "Door knock", message: "Election is in 2 days. Do you have a plan to vote?" },
  { daysOut: 1, label: "1 day", contact: "Final GOTV contact", method: "Phone, text, and/or door", message: "Tomorrow is election day. Your polling place is [X]. Polls open at [time]." },
  { daysOut: 0, label: "Election Day", contact: "Election day chase", method: "Phone, text, door", message: "Have you voted yet? Polls close at [time]. Need a ride?" },
];

/** The live 4-3-2-1 round for a days-to-election count, or null outside the window. */
export function activeContactRound(daysToElection: number): ContactRound | null {
  return CONTACT_SCHEDULE.find((r) => r.daysOut === daysToElection) ?? null;
}
