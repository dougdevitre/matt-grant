import Link from "next/link";
import { getOverview } from "@/lib/queries";
import { dollars } from "@/lib/money";
import { DbNotice, PageHeader } from "@/components/dashboard/Notice";

// Illustrative primary-cycle fundraising goal — replace with the real number.
const GOAL_CENTS = 25000000; // $250,000

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-6">
      <p className="eyebrow text-slate">{label}</p>
      <p className="mt-3 font-display text-4xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-1 font-mono text-xs text-field">{sub}</p>}
    </div>
  );
}

export default async function OverviewPage() {
  const o = await getOverview();

  if (!o.connected) {
    return (
      <>
        <PageHeader kicker="Campaign manager" title="Overview" />
        <DbNotice />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Raised (primary)" value="$0" />
          <Stat label="Cash on hand" value="$0" />
          <Stat label="Donors" value="0" />
          <Stat label="Active volunteers" value="0" />
        </div>
      </>
    );
  }

  const pct = Math.min(100, Math.round((o.raisedCents / GOAL_CENTS) * 100));
  const taskTotal = o.tasksTodo + o.tasksDoing + o.tasksDone;
  const doneMiles = o.milestones.filter((m) => m.done).length;

  return (
    <>
      <PageHeader kicker="Campaign manager" title="Overview" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Raised (primary)" value={dollars(o.raisedCents)} sub={`${pct}% of goal`} />
        <Stat label="Cash on hand" value={dollars(o.cashOnHandCents)} sub={`${dollars(o.spentCents)} spent`} />
        <Stat label="Donors" value={String(o.donorCount)} />
        <Stat label="Active volunteers" value={String(o.volActive)} sub={`${o.volunteerTotal} total`} />
      </div>

      {/* Fundraising thermometer */}
      <div className="card mt-6 p-6">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow text-slate">Fundraising · primary cycle</p>
          <p className="font-mono text-sm text-slate">
            {dollars(o.raisedCents)} <span className="text-slate/60">/ {dollars(GOAL_CENTS)} (illustrative)</span>
          </p>
        </div>
        <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-gradient-to-r from-field to-gold transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
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
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full ${color}`}
                    style={{ width: taskTotal ? `${((n as number) / taskTotal) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
          <Link href="/dashboard/tasks" className="btn-ghost mt-6 w-full">Open the board</Link>
        </div>
      </div>
    </>
  );
}
