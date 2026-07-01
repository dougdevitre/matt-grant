// Personalized dashboard logic — PURE and deterministic (date/signals passed in, no
// Date.now/DB), so it's fully unit-tested. Turns a signed-in user's signals into a
// single "suggested next step" (a civic → engagement → leadership priority cascade,
// mirroring the NEXT_ACTION pattern in lib/volunteers/score.ts) plus a readiness
// checklist (registered to vote · made a donation · connected with a team captain).
import type { Role } from "@/lib/rbac";
import { CAMPAIGN, VOTER_LOOKUP } from "@/lib/site";
import type { DueState } from "@/lib/dashboard/due";

export type PersonalSignals = {
  role: Role;
  isVolunteer: boolean; // has a volunteer record (can join a captain's team)
  registeredToVote: boolean; // self-attested
  hasDonated: boolean; // derived from donor records
  captainName: string | null; // first name of their assigned captain, if any
  myTask: { title: string; href: string; state: DueState; label: string } | null; // most urgent open assigned, dated task
  topAction: { title: string; href: string } | null; // best profile-matched action
  nextEvent: { title: string; whenLabel: string; href: string } | null; // soonest upcoming event
  daysToPrimary: number | null; // days until the primary (for urgency framing)
};

const isLeader = (role: Role) => role === "admin" || role === "captain";

// ── Suggested next step ──────────────────────────────────────────────────────
export type NextStepKind = "register" | "task" | "captain" | "event" | "action" | "donate" | "lead" | "allset";
export type NextStep = { kind: NextStepKind; title: string; detail: string; href: string; cta: string };

/**
 * The single most useful thing this person can do next. Priority: get registered →
 * (volunteers) join a team → a dated event → a matched action → give → then a
 * role-tailored "keep leading / all set". Deterministic; no side effects.
 */
export function nextStep(s: PersonalSignals): NextStep {
  if (!s.registeredToVote) {
    return {
      kind: "register",
      title: "Make sure you're registered to vote",
      detail: "It takes two minutes to confirm you're registered at your current address — the foundation for everything else.",
      href: VOTER_LOOKUP,
      cta: "Check my registration",
    };
  }
  // An overdue assigned task jumps the queue — it's a commitment already made.
  if (s.myTask && s.myTask.state === "overdue") {
    return {
      kind: "task",
      title: `Finish your overdue task: ${s.myTask.title}`,
      detail: `This was assigned to you and is now ${s.myTask.label}. Close it out or move it forward.`,
      href: s.myTask.href,
      cta: "Open the task board",
    };
  }
  if (s.isVolunteer && !s.captainName) {
    return {
      kind: "captain",
      title: "Connect with your team captain",
      detail: "Join a local team so a captain can plug you into doors, calls, and events near you.",
      href: "/community",
      cta: "Join a team",
    };
  }
  // A task due today/soon is more concrete than a generic event or matched action.
  if (s.myTask && (s.myTask.state === "today" || s.myTask.state === "soon")) {
    return {
      kind: "task",
      title: `Your task ${s.myTask.label}: ${s.myTask.title}`,
      detail: "This is assigned to you. Knock it out while it's fresh.",
      href: s.myTask.href,
      cta: "Open the task board",
    };
  }
  if (s.nextEvent) {
    return {
      kind: "event",
      title: `You've got ${s.nextEvent.title} ${s.nextEvent.whenLabel}`,
      detail: "Confirm you're going and bring a neighbor — showing up in person moves the race the most.",
      href: s.nextEvent.href,
      cta: "See the event",
    };
  }
  if (s.topAction) {
    return {
      kind: "action",
      title: `Take action: ${s.topAction.title}`,
      detail: "This is matched to what you told us you'd do. Raise your hand and your captain gets you started.",
      href: s.topAction.href,
      cta: "Do this",
    };
  }
  if (!s.hasDonated) {
    return {
      kind: "donate",
      title: "Chip in to fund the work",
      detail: `Every dollar funds doors, calls, and mail before ${CAMPAIGN.electionLabel}.`,
      href: CAMPAIGN.donateUrl,
      cta: "Donate",
    };
  }
  // Everything essential is done — point leaders at leadership, members at growth.
  if (s.role === "admin") {
    return { kind: "lead", title: "You're all set — keep the team moving", detail: "Check who needs access and that setup is green.", href: "/dashboard/team", cta: "Open Team" };
  }
  if (s.role === "captain") {
    return { kind: "lead", title: "You're all set — lead your team", detail: "Run your next play and check your coverage.", href: "/dashboard/playbook", cta: "Open playbook" };
  }
  return { kind: "allset", title: "You're all set — bring a neighbor", detail: "This race is won one neighbor at a time. Invite someone to join the movement.", href: "/act", cta: "Invite a neighbor" };
}

// ── Readiness checklist ──────────────────────────────────────────────────────
export type ChecklistKey = "register" | "donate" | "captain";
export type ChecklistItem = { key: ChecklistKey; label: string; done: boolean; cta: { text: string; href: string } };

/**
 * The three-step readiness checklist. `register` and `donate` show for everyone;
 * `captain` shows only for non-leaders (admins/captains lead a team, they don't
 * join one). Done-state is derived from real signals.
 */
export function buildChecklist(s: PersonalSignals): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      key: "register",
      label: "Registered to vote",
      done: s.registeredToVote,
      cta: { text: s.registeredToVote ? "Check your status" : "Register / check", href: VOTER_LOOKUP },
    },
    {
      key: "donate",
      label: "Made a donation",
      done: s.hasDonated,
      cta: { text: s.hasDonated ? "Give again" : "Chip in", href: CAMPAIGN.donateUrl },
    },
  ];
  if (!isLeader(s.role)) {
    items.push({
      key: "captain",
      label: "Connected with your team captain",
      done: !!s.captainName,
      cta: s.captainName
        ? { text: `You're on ${s.captainName}'s team`, href: "/community" }
        : s.isVolunteer
          ? { text: "Join a team", href: "/community" }
          : { text: "Get involved", href: "/act" },
    });
  }
  return items;
}

/** How many checklist items are complete (for the "N of M" progress label). */
export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}
