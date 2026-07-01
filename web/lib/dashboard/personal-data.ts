// Server-side gatherer for the personalized dashboard. Composes the signals the
// PURE selectors in personal.ts need, from the reads the app already has. Every
// source is best-effort — one failed lookup never blanks the card. `now` is
// injectable for tests; formatting stays here so personal.ts stays pure.
import "server-only";
import type { Role } from "@/lib/rbac";
import { CAMPAIGN } from "@/lib/site";
import { getProfile } from "@/lib/profile";
import { supporterTierForEmail } from "@/lib/supporterTier";
import { getMyVolunteerProfile } from "@/lib/volunteers/self";
import { listActiveCaptains } from "@/lib/volunteers/captains";
import { listMatchableTasks, matchTasks } from "@/lib/volunteers/task-match";
import { listEvents } from "@/lib/events";
import { getTasks } from "@/lib/queries";
import { classifyDue, dueSortKey } from "@/lib/dashboard/due";
import type { PersonalSignals } from "@/lib/dashboard/personal";

const DAY = 86_400_000;
const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const pad = (n: number) => String(n).padStart(2, "0");
const localYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// A friendly relative label for an event date: today / tomorrow / this <weekday> /
// on <Mon D>. Past-guarded by the caller (only upcoming events are passed).
function whenLabel(startISO: string, now: Date): string {
  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) return "soon";
  const diff = Math.round((dateOnly(start) - dateOnly(now)) / DAY);
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff < 7) return `this ${start.toLocaleDateString("en-US", { weekday: "long" })}`;
  return `on ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function gatherPersonalSignals(
  email: string | null | undefined,
  role: Role,
  now: Date = new Date(),
): Promise<PersonalSignals> {
  const [profile, tier, vol, captains, events, tasks] = await Promise.all([
    safe(() => getProfile(email), null),
    safe(() => supporterTierForEmail(email), { tier: "supporter" as const, isDonor: false, isVolunteer: false, donor: { hasDonated: false, totalCents: 0, gifts: 0 } }),
    safe(() => getMyVolunteerProfile(email), null),
    safe(() => listActiveCaptains(), [] as Awaited<ReturnType<typeof listActiveCaptains>>),
    safe(() => listEvents(), { connected: false, rows: [] as Awaited<ReturnType<typeof listEvents>>["rows"] }),
    safe(() => getTasks(), { connected: false, rows: [] as Awaited<ReturnType<typeof getTasks>>["rows"] }),
  ]);

  // Captain first name (privacy: never their email).
  const captainName = vol?.captainEmail
    ? captains.find((c) => c.email === vol.captainEmail!.toLowerCase())?.firstName ?? null
    : null;

  // The signed-in user's most urgent open, dated task. Tasks are assigned by
  // volunteerId, which equals the volunteer record SK "e:<email>" — so we can match
  // them to the authenticated email. Soonest due (overdue first) wins.
  const today = localYmd(now);
  let myTask: PersonalSignals["myTask"] = null;
  const myVid = email ? `e:${email.trim().toLowerCase()}` : null;
  if (myVid) {
    const mine = tasks.rows
      .filter((t) => t.volunteerId === myVid && t.status !== "DONE" && !!t.dueDate)
      .sort((a, b) => dueSortKey(a.dueDate) - dueSortKey(b.dueDate))[0];
    if (mine) {
      const due = classifyDue(mine.dueDate, today);
      myTask = { title: mine.title, href: "/dashboard/tasks", state: due.state, label: due.label };
    }
  }

  // Top profile-matched action → the /community hub where they raise their hand.
  let topAction: PersonalSignals["topAction"] = null;
  if (vol) {
    const tasks = await safe(() => listMatchableTasks(), []);
    const best = matchTasks(vol, tasks, 1)[0];
    if (best) topAction = { title: best.task.name, href: "/community" };
  }

  // Soonest upcoming PUBLISHED event → the public event page.
  const nowMs = now.getTime();
  const upcoming = events.rows
    .filter((e) => e.status === "PUBLISHED" && Date.parse(e.start) >= nowMs)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  const nextEvent = upcoming
    ? { title: upcoming.title || "an event", whenLabel: whenLabel(upcoming.start, now), href: `/events/${upcoming.id}` }
    : null;

  const primaryMs = Date.parse(CAMPAIGN.electionDate);
  const daysToPrimary = Number.isFinite(primaryMs) && primaryMs >= nowMs ? Math.ceil((primaryMs - nowMs) / DAY) : null;

  return {
    role,
    isVolunteer: tier.isVolunteer || !!vol,
    registeredToVote: profile?.registeredToVote === true,
    hasDonated: tier.isDonor,
    captainName,
    myTask,
    topAction,
    nextEvent,
    daysToPrimary,
  };
}
