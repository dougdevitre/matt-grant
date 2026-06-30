// Captain badges — milestones derived PURELY from a captain's scorecard (signals,
// component scores, and board rank). Each badge maps to the same quality-first
// rubric as the score (P3): they recognize real organizing outcomes, never raw
// volume, and never anything tied to contacting opted-out volunteers. Powers the
// leaderboard (P4) and the badge strip on the scorecard.
import { SPAN_MIN, SPAN_MAX, type CaptainScore } from "@/lib/volunteers/score";

export type BadgeId =
  | "on-the-map"
  | "healthy-team"
  | "no-one-cold"
  | "activator"
  | "boots-on-ground"
  | "excellent"
  | "top-captain";

export type Badge = {
  id: BadgeId;
  label: string;
  icon: string; // short emoji glyph (decorative; label carries the meaning)
  earned: string; // what earning it means
  howTo: string; // how to earn it when locked (honest, maps to a real action)
};

export type BadgeAward = Badge & { earned_: boolean };

// Inputs the predicates need beyond the score.
export type BadgeContext = {
  score: CaptainScore;
  rank: number; // 1-based position on the board
  totalCaptains: number;
};

const comp = (score: CaptainScore, key: string) => score.components.find((c) => c.key === key)?.score ?? 0;

// The catalog. Order = display order (foundational → competitive).
const CATALOG: { badge: Badge; earned: (ctx: BadgeContext) => boolean }[] = [
  {
    badge: {
      id: "on-the-map",
      label: "On the map",
      icon: "📍",
      earned: "Assigned to a coverage region",
      howTo: "Ask an admin to assign your region on the Team page.",
    },
    earned: ({ score }) => comp(score, "region") === 100,
  },
  {
    badge: {
      id: "healthy-team",
      label: "Healthy team",
      icon: "⚖️",
      earned: `A right-sized team of ${SPAN_MIN}–${SPAN_MAX}`,
      howTo: `Recruit toward ${SPAN_MIN}–${SPAN_MAX} volunteers — or split if you're over ${SPAN_MAX}.`,
    },
    earned: ({ score }) => comp(score, "span") === 100,
  },
  {
    badge: {
      id: "no-one-cold",
      label: "No one left cold",
      icon: "🤝",
      earned: "Every contactable volunteer welcomed, contacted, or engaged",
      howTo: "Welcome and check in with every volunteer on your team.",
    },
    earned: ({ score }) => comp(score, "engaged") === 100,
  },
  {
    badge: {
      id: "activator",
      label: "Activator",
      icon: "⚡",
      earned: "Most of your team is actively working",
      howTo: "Help volunteers take a first real action so they move to Active.",
    },
    earned: ({ score }) => comp(score, "activated") >= 70,
  },
  {
    badge: {
      id: "boots-on-ground",
      label: "Boots on the ground",
      icon: "🥾",
      earned: "Hosted or owns a recent in-person event",
      howTo: "Put one in-person event on the calendar this month.",
    },
    earned: ({ score }) => comp(score, "events") === 100,
  },
  {
    badge: {
      id: "excellent",
      label: "Excellent captain",
      icon: "🌟",
      earned: "Reached the Excellent tier overall",
      howTo: "Lift every part of your scorecard into the green.",
    },
    earned: ({ score }) => score.tier === "excellent",
  },
  {
    badge: {
      id: "top-captain",
      label: "Top of the board",
      icon: "🏆",
      earned: "The highest-scoring captain right now",
      howTo: "Climb the leaderboard — the #1 captain holds this.",
    },
    earned: ({ score, rank }) => score.hasActivity && score.total > 0 && rank === 1,
  },
];

/** All badges with their earned state for one captain. */
export function computeBadges(ctx: BadgeContext): BadgeAward[] {
  return CATALOG.map(({ badge, earned }) => ({ ...badge, earned_: earned(ctx) }));
}

/** Just the earned badges (display order preserved). */
export function earnedBadges(ctx: BadgeContext): Badge[] {
  return CATALOG.filter(({ earned }) => earned(ctx)).map(({ badge }) => badge);
}

export const TOTAL_BADGES = CATALOG.length;
