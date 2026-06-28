import { getMyVolunteerProfile } from "@/lib/volunteers/self";
import { listMatchableTasks, matchTasks } from "@/lib/volunteers/task-match";
import { CAMPAIGN } from "@/lib/site";

// "Your next actions" — the last hop that turns a /join signup into doing. Reads the
// signed-in user's OWN volunteer profile and the Active, community-visible Airtable
// task templates, and shows the ones matched to them (by role, skill, commitment,
// mode, availability). Async server component; self-scoped to the passed email.
//
// Degrades quietly: no Airtable / nothing Active yet → renders a soft "coming soon"
// for known volunteers, and nothing at all for people without a volunteer profile
// (the donate/share/take-action cards already serve them).
const chip = "rounded-sm border border-line px-2 py-0.5 font-mono text-[0.65rem] text-slate";

function interestMailto(taskName: string): string {
  const subject = encodeURIComponent(`I want to help: ${taskName}`);
  const body = encodeURIComponent(
    `Hi — I'd like to help with "${taskName}" for Matt Grant for Congress. Please let me know the next step.`,
  );
  return `mailto:${CAMPAIGN.email}?subject=${subject}&body=${body}`;
}

export async function MatchedActions({ email }: { email?: string | null }) {
  const [profile, tasks] = await Promise.all([getMyVolunteerProfile(email), listMatchableTasks()]);
  const matches = matchTasks(profile ?? {}, tasks, 6);

  if (matches.length === 0) {
    // Only reassure people who actually signed up to help; pure supporters just
    // see the standard ways-to-help section below.
    if (!profile) return null;
    return (
      <div className="mt-14">
        <h2 className="text-2xl font-semibold">Your next actions</h2>
        <p className="mt-2 max-w-prose text-sm text-slate">
          Thanks for telling us how you&apos;ll help — we&apos;re lining up actions that fit you. A captain will be
          in touch, and matched tasks will appear here soon.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-14">
      <p className="eyebrow text-brick">Matched to you</p>
      <h2 className="mt-2 text-2xl font-semibold">Your next actions</h2>
      <p className="mt-1 max-w-prose text-sm text-slate">
        Based on what you told us, here&apos;s where you fit. Tell us you&apos;re in and a captain will get you started.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map(({ task, reasons }) => (
          <div key={task.id} className="card flex flex-col p-6">
            <p className="font-display text-lg font-semibold">{task.name}</p>
            {task.whatTheyDo && <p className="mt-1 text-sm text-slate">{task.whatTheyDo}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {task.mode && <span className={chip}>{task.mode === "Digital" ? "From home" : task.mode === "In-person" ? "In person" : "Either"}</span>}
              {task.effort && <span className={chip}>{task.effort}</span>}
              {reasons.length > 0 && <span className={`${chip} border-brick/30 text-brick`}>matches: {reasons[0]}</span>}
            </div>
            <a href={interestMailto(task.name)} className="mt-4 text-sm font-semibold text-brick hover:underline">
              I&apos;m interested →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
