import { listExtActions, extAdoptionSummary } from "@/lib/audit";

// Admin-only "who is using the extension" panel on /dashboard/extension. Reads the
// AUDIT#ext trail — per-staffer adoption (so admins can nudge non-adopters) plus a
// recent-actions log. Server component; best-effort readers return empty on DB off,
// so it renders a clean empty state rather than erroring. Mirrors the access-log
// markup on the Team & access page.

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// The dotted verbs recordExtAction writes (task.create, event.update, …) → plain text.
const actionLabel = (a: string) =>
  ({
    "task.create": "created a task",
    "task.status": "moved a task",
    "event.create": "created an event",
    "event.update": "updated an event",
    "issue.status": "moderated an issue",
    "issue.text": "edited an issue",
    "issue.delete": "removed an issue",
    "expense.create": "proposed an expense",
    "expense.transition": "updated an expense",
  })[a] ?? a;

export async function ExtensionActivity() {
  const [summary, recent] = await Promise.all([extAdoptionSummary(), listExtActions(15)]);

  return (
    <div className="mt-6 card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow text-slate">Extension activity · admin</p>
        <p className="font-mono text-xs text-slate">
          {summary.activeLast7d} active · 7d · {summary.totalActions} total actions
        </p>
      </div>

      {summary.totalActions === 0 ? (
        <p className="mt-3 text-sm text-slate">
          No extension activity yet. Once staff install it and act (add a task, edit an event), their
          usage shows here — a quick way to see who&rsquo;s adopted it and who to nudge.
        </p>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {/* Per-staffer adoption */}
          <div>
            <p className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">Who&rsquo;s using it</p>
            <ul className="mt-2 divide-y divide-line rounded-sm border border-line">
              {summary.perActor.slice(0, 10).map((a) => (
                <li key={a.actor} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-ink">{a.actor}</span>
                  <span className="shrink-0 font-mono text-xs text-slate">
                    {a.count} · {when(a.lastAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recent actions log */}
          <div>
            <p className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">Recent actions</p>
            <ul className="mt-2 divide-y divide-line rounded-sm border border-line">
              {recent.map((e, i) => (
                <li key={`${e.at}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-ink">
                    <span className="font-semibold">{e.actor}</span> {actionLabel(e.action)}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-slate">{when(e.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
