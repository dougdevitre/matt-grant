import type { OptinGrowth as Growth } from "@/lib/reports/optinGrowth";

// Opt-in growth panel — "where opt-ins come from" + a recent trend, so the campaign
// invests in the channels that convert. Presentational + dependency-free (plain CSS
// bars, no chart lib); the numbers come from optinGrowth() over the consent ledger.

const num = (n: number) => n.toLocaleString("en-US");

export function OptinGrowth({ growth }: { growth: Growth }) {
  const { totals, bySource, byDay, recentOptIns, windowDays } = growth;
  const peak = Math.max(1, ...byDay.map((d) => d.optIns));
  const top = bySource[0]?.count ?? 0;

  return (
    <div className="card mt-8 p-5">
      <p className="eyebrow text-brick">Opt-in growth</p>
      <p className="mt-1 text-xs text-slate">
        Where your textable list comes from and how it&rsquo;s growing — grow these and enrichment scores more of
        them. Only opted-in numbers can be texted.
      </p>

      {/* Totals */}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          { l: "Opted-in", v: num(totals.optedIn) },
          { l: `New · last ${windowDays}d`, v: `+${num(recentOptIns)}` },
          { l: "Opted-out", v: num(totals.optedOut) },
        ].map((t) => (
          <div key={t.l} className="rounded-sm border border-line bg-paper px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">{t.l}</p>
            <p className="text-lg font-semibold tabular-nums text-ink">{t.v}</p>
          </div>
        ))}
      </div>

      {totals.optedIn === 0 ? (
        <p className="mt-4 text-xs text-gold-ink">
          No opt-ins yet. Grow the list with the text keyword (Text MATT to 844-314-7912), the join/contact/RSVP
          form checkboxes, and the WinRed SMS box — each one adds a textable supporter.
        </p>
      ) : (
        <>
          {/* By source */}
          <p className="mt-5 text-xs font-semibold text-slate">Where opt-ins come from</p>
          <div className="mt-2 space-y-1.5">
            {bySource.map((s) => (
              <div key={s.source} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-xs text-ink" title={s.label}>{s.label}</span>
                <span className="relative h-4 flex-1 rounded-sm bg-paper">
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm bg-field/60"
                    style={{ width: `${top > 0 ? Math.max(2, (s.count / top) * 100) : 0}%` }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right font-mono text-[0.65rem] tabular-nums text-slate">
                  {num(s.count)} · {Math.round(s.pct)}%
                </span>
              </div>
            ))}
          </div>

          {/* Trend */}
          <p className="mt-5 text-xs font-semibold text-slate">Opt-ins · last {windowDays} days</p>
          <div className="mt-2 flex items-end gap-px" style={{ height: "48px" }} aria-hidden>
            {byDay.map((d) => (
              <span
                key={d.date}
                title={`${d.date}: ${d.optIns}`}
                className="flex-1 rounded-t-sm bg-ink/70"
                style={{ height: `${d.optIns > 0 ? Math.max(6, (d.optIns / peak) * 100) : 2}%` }}
              />
            ))}
          </div>
          <p className="mt-1 font-mono text-[0.6rem] text-slate">
            {byDay[0]?.date} → {byDay[byDay.length - 1]?.date} · peak {num(peak)}/day
          </p>
        </>
      )}
    </div>
  );
}
