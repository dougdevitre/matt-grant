// Captain scorecard data — turns the live roster, events, and staff regions into
// per-captain signals, then scores them. The signal derivation is a PURE exported
// helper (deriveSignals) so the opt-out and quality rules are unit-tested; the
// gather* functions are server-only readers that fetch and delegate.
import "server-only";
import { listStaff } from "@/lib/staff";
import { getVolunteers, type VolunteerRow } from "@/lib/queries";
import { listEvents } from "@/lib/events";
import type { EventRow } from "@/lib/events/types";
import { scoreCaptain, type CaptainScore, type CaptainSignals } from "@/lib/volunteers/score";

// How far back a published event still counts toward the in-person play. Generous
// enough to span the monthly cadence with slack.
export const EVENT_WINDOW_DAYS = 45;

const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const ENGAGED_STATUSES = new Set(["CONTACTED", "ACTIVE"]);

/** A contactable volunteer is on the roster and has NOT opted out of contact. */
const isContactable = (v: VolunteerRow) => !v.optedOut;
/** Engaged = welcomed/contacted, working, or self-raised a hand for a task. */
const isEngaged = (v: VolunteerRow) =>
  ENGAGED_STATUSES.has(v.status) || v.interestedTasks.length > 0 || !!v.lastContactedAt;

/**
 * PURE: derive a captain's signals from their team, their owned events, and whether
 * they have a region. Opt-out safety lives here — opted-out volunteers count toward
 * roster size (span) but are excluded from the contactable denominator and every
 * engagement/activation numerator, so the score never rewards contacting them.
 */
export function deriveSignals(
  team: VolunteerRow[],
  recentEvents: number,
  hasRegion: boolean,
): CaptainSignals {
  const contactableTeam = team.filter(isContactable);
  return {
    rosterSize: team.length,
    contactable: contactableTeam.length,
    activated: contactableTeam.filter((v) => v.status === "ACTIVE").length,
    engaged: contactableTeam.filter(isEngaged).length,
    recentEvents,
    hasRegion,
  };
}

/** A published event counts if this captain owns it and it started within the window. */
function recentOwnedEvents(events: EventRow[], captainEmail: string, now: Date): number {
  const cutoff = now.getTime() - EVENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return events.filter((e) => {
    if (e.status !== "PUBLISHED") return false;
    if (lc(e.captain?.id) !== captainEmail) return false;
    const t = Date.parse(e.start);
    return Number.isFinite(t) && t >= cutoff; // counts recent past + any upcoming
  }).length;
}

export type CaptainScorecard = {
  email: string;
  name: string;
  firstName: string;
  regions: string[];
  signals: CaptainSignals;
  score: CaptainScore;
};

const firstNameOf = (name?: string, email?: string) =>
  name?.trim().split(/\s+/)[0] || email?.split("@")[0] || "Captain";

/**
 * Score every active captain. Sorted by total desc then name (deterministic). `now`
 * is injectable for testing; defaults to the current time. [] when DB is off.
 */
export async function gatherCaptainScorecards(now: Date = new Date()): Promise<CaptainScorecard[]> {
  try {
    const [staff, vols, events] = await Promise.all([listStaff(), getVolunteers(), listEvents()]);
    const captains = staff.filter((s) => s.status === "active" && s.role === "captain");

    // Group the roster by captain once.
    const teamByCaptain = new Map<string, VolunteerRow[]>();
    for (const v of vols.rows) {
      const c = lc(v.captainEmail);
      if (!c) continue;
      const list = teamByCaptain.get(c) ?? [];
      list.push(v);
      teamByCaptain.set(c, list);
    }

    const cards = captains.map((s) => {
      const email = lc(s.email);
      const team = teamByCaptain.get(email) ?? [];
      const recent = recentOwnedEvents(events.rows, email, now);
      const hasRegion = (s.regions?.length ?? 0) > 0;
      const signals = deriveSignals(team, recent, hasRegion);
      return {
        email,
        name: s.name || s.email,
        firstName: firstNameOf(s.name, s.email),
        regions: s.regions ?? [],
        signals,
        score: scoreCaptain(signals),
      };
    });

    return cards.sort((a, b) => b.score.total - a.score.total || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** One captain's scorecard by email (their own view). null when not a captain / DB off. */
export async function gatherCaptainScorecard(email: string, now: Date = new Date()): Promise<CaptainScorecard | null> {
  const target = lc(email);
  const cards = await gatherCaptainScorecards(now);
  return cards.find((c) => c.email === target) ?? null;
}
