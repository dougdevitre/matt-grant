import Link from "next/link";
import { redirect } from "next/navigation";
import { getOverview } from "@/lib/queries";
import { listStaff } from "@/lib/staff";
import { dollars } from "@/lib/money";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { onboardingDismissed } from "@/lib/onboarding";
import { extensionConnected } from "@/lib/extension";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { PersonalSummary } from "@/components/dashboard/PersonalSummary";
import { StatTile } from "@/components/ui/StatTile";
import { Meter } from "@/components/ui/Meter";
import { deltaChip } from "@/lib/trends";

// Illustrative primary-cycle fundraising goal — replace with the real number.
const GOAL_CENTS = 25000000; // $250,000

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  // The overview shows finance/donor totals, so it must gate viewOverview itself —
  // not rely on the sidebar hiding the link. Non-staff roles that land here are
  // routed to the one surface they CAN see, instead of leaking totals or bouncing
  // into a denied-redirect loop: partner → Peace Room, supporter → community hub.
  const { role, email } = await staffGate();
  if (!can(role, "viewOverview")) {
    if (can(role, "viewPeaceRoom")) redirect("/dashboard/peace-room");
    if (can(role, "viewCommunity")) redirect("/community");
    redirect("/sign-in");
  }

  const { denied } = await searchParams;
  const o = await getOverview();

  if (!o.connected) {
    return (
      <>
        <PageHeader kicker="Campaign manager" title="Overview" />
        <DbNotice />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Raised (primary)" value="$0" />
          <StatTile label="Cash on hand" value="$0" />
          <StatTile label="Donors" value="0" />
          <StatTile label="Active volunteers" value="0" />
        </div>
      </>
    );
  }

  const pct = Math.min(100, Math.round((o.raisedCents / GOAL_CENTS) * 100));
  const taskTotal = o.tasksTodo + o.tasksDoing + o.tasksDone;
  const doneMiles = o.milestones.filter((m) => m.done).length;
  // Independent reads — fetch in parallel on this hot authenticated path (getOverview
  // above must stay first: it gates the !connected early return).
  const [staff, dismissed] = await Promise.all([listStaff(), onboardingDismissed(email)]);
  const teamInvited = staff.filter((s) => s.status === "active").length;
  const showOnboarding = !dismissed;

  return (
    <>
      <PageHeader kicker="Campaign manager" title="Overview" />

      {denied && (
        <div className="mb-6 rounded-sm border border-brick/40 bg-brick/10 px-4 py-3 text-sm text-brick">
          That section ({denied}) is admin-only. Ask an admin for access if you need it.
        </div>
      )}

      {/* Personal "what to do next" — shown first so anyone landing here knows their
          own next step before the campaign-wide overview. */}
      <PersonalSummary email={email} role={role ?? "admin"} />

      {showOnboarding && (
        <OnboardingChecklist hasData={o.donorCount > 0 || o.volunteerTotal > 0} teamInvited={teamInvited} />
      )}

      <HowTo
        steps={[
          "Scan the four stat cards for a daily pulse: raised this cycle, cash on hand, total donors, and active volunteers.",
          "Watch the fundraising thermometer against the primary goal — the $250,000 is an illustrative placeholder; set the real number in code.",
          "Read the milestone timeline to see which phase you are in; click the count to open the full Plan.",
          "Use the task rollup to see To-do / In-progress / Done, then click “Open the board” to triage.",
          "Figures are live only once the database is connected — you will see a notice here when it is not.",
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Raised (primary)"
          value={dollars(o.raisedCents)}
          sub={`${pct}% of goal`}
          spark={o.trends.raised.byDay}
          delta={deltaChip(o.trends.raised.last7.recent, o.trends.raised.last7.prior, {
            label: `${dollars(o.trends.raised.last7.recent)} · 7d`,
            goodWhenUp: true,
          })}
        />
        {/* Cash on hand stays a snapshot — expenditures carry no per-row date, so
            there's no honest spend trend to draw. */}
        <StatTile label="Cash on hand" value={dollars(o.cashOnHandCents)} sub={`${dollars(o.spentCents)} spent`} />
        <StatTile
          label="Donors"
          value={String(o.donorCount)}
          spark={o.trends.donors.byDay}
          delta={deltaChip(o.trends.donors.last7.recent, o.trends.donors.last7.prior, {
            label: `${o.trends.donors.last7.recent} new · 7d`,
            goodWhenUp: true,
          })}
        />
        <StatTile
          label="Active volunteers"
          value={String(o.volActive)}
          sub={`${o.volunteerTotal} total`}
          spark={o.trends.volunteers.byDay}
          delta={deltaChip(o.trends.volunteers.last7.recent, o.trends.volunteers.last7.prior, {
            label: `${o.trends.volunteers.last7.recent} new · 7d`,
            goodWhenUp: true,
          })}
        />
      </div>

      {/* Fundraising thermometer */}
      <div className="card mt-6 p-6">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow text-slate">Fundraising · primary cycle</p>
          <p className="font-mono text-sm text-slate">
            {dollars(o.raisedCents)} <span className="text-slate/60">/ {dollars(GOAL_CENTS)} (illustrative)</span>
          </p>
        </div>
        <Meter
          label="Raised toward the primary goal"
          value={pct}
          valueText={`${dollars(o.raisedCents)} of ${dollars(GOAL_CENTS)} (${pct}%)`}
          trackClassName="mt-3 h-4 w-full overflow-hidden rounded-full bg-line"
          fillClassName="rounded-full bg-gradient-to-r from-field to-gold"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Milestone timeline */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-slate">Plan milestones</p>
            <Link href="/dashboard/plan" className="font-mono text-xs text-field hover:underline">
              {doneMiles}/{o.milestones.length} complete →
            </Link>
          </div>
          <ol className="mt-5 space-y-0">
            {o.milestones.map((m, i) => (
              <li key={m.id} className="relative flex gap-4 pb-5 last:pb-0">
                {i < o.milestones.length - 1 && (
                  <span className="absolute left-[7px] top-4 h-full w-px bg-line" aria-hidden />
                )}
                <span
                  className={`relative mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                    m.done ? "bg-gold" : "border-2 border-line bg-white"
                  }`}
                  aria-hidden
                />
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-mono text-[0.65rem] uppercase tracking-eyebrow text-field">{m.phase}</span>
                    <span className="font-mono text-xs text-slate">
                      {new Date(m.target).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className={`font-semibold ${m.done ? "text-slate line-through" : "text-ink"}`}>{m.title}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Task rollup */}
        <div className="card p-6">
          <p className="eyebrow text-slate">Task board</p>
          <div className="mt-5 space-y-4">
            {[
              ["To do", o.tasksTodo, "bg-brick"],
              ["In progress", o.tasksDoing, "bg-gold"],
              ["Done", o.tasksDone, "bg-field"],
            ].map(([label, n, color]) => (
              <div key={label as string}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-ink">{label}</span>
                  <span className="font-mono text-slate">{n as number}</span>
                </div>
                <Meter
                  label={`${label as string} tasks`}
                  value={n as number}
                  max={taskTotal || 1}
                  valueText={`${n as number} ${label as string}`}
                  trackClassName="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line"
                  fillClassName={color as string}
                />
              </div>
            ))}
          </div>
          <Link href="/dashboard/tasks" className="btn-ghost mt-6 w-full">Open the board</Link>
        </div>
      </div>

      {/* Extension promo — only when the /api/ext/* surface is actually turned on, so
          we never advertise a tool that can't reach data yet. Captain-first copy;
          shown to every staff tier (all hold viewOverview). */}
      {extensionConnected() && (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-6">
          <div>
            <p className="eyebrow text-slate">Field tools</p>
            <p className="mt-1 text-sm text-ink">Work the field from your browser — tasks, events, and your overview in one click with the campaign Chrome extension.</p>
          </div>
          <Link href="/dashboard/extension" className="btn-primary">Get the extension</Link>
        </div>
      )}

      {can(role, "manageSocial") && (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-6">
          <div>
            <p className="eyebrow text-slate">Social command center · admin</p>
            <p className="mt-1 text-sm text-ink">Schedule and publish to every channel, and optimize each profile for awareness + conversion.</p>
          </div>
          <Link href="/dashboard/social" className="btn-primary">Open command center</Link>
        </div>
      )}
    </>
  );
}
