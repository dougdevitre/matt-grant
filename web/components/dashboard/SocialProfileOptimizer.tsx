"use client";

import { useActionState, useState } from "react";
import { analyzeProfileAction, saveFootprintSnapshot } from "@/app/dashboard/social/actions";
import { CHANNELS, CHANNEL_IDS, type ChannelId } from "@/lib/social/channels";
import type { FootprintReport } from "@/lib/social/optimize";
import type { FootprintSnapshot } from "@/lib/social/footprint";

const FIELDS: { key: string; label: string }[] = [
  { key: "followers", label: "Followers" },
  { key: "posts30d", label: "Posts (30d)" },
  { key: "impressions30d", label: "Impressions (30d)" },
  { key: "engagements30d", label: "Engagements (30d)" },
  { key: "profileVisits30d", label: "Profile visits (30d)" },
  { key: "linkClicks30d", label: "Link clicks (30d)" },
  { key: "conversions30d", label: "Conversions (30d)" },
];

const priColor = { high: "text-brick", medium: "text-gold-ink", low: "text-slate" } as const;

export function SocialProfileOptimizer({ history = [] }: { history?: FootprintSnapshot[] }) {
  const [state, action, pending] = useActionState<{ report: FootprintReport | null; message: string }, FormData>(analyzeProfileAction, { report: null, message: "" });
  const [active, setActive] = useState<ChannelId[]>(["x", "facebook", "instagram"]);
  const input = "w-24 rounded-sm border border-line bg-white px-2 py-1 text-sm text-ink focus:border-field";
  const toggle = (ch: ChannelId) => setActive((a) => (a.includes(ch) ? a.filter((x) => x !== ch) : [...a, ch]));
  const report = state.report;

  return (
    <form action={action} className="space-y-5">
      <div className="card p-5">
        <p className="eyebrow text-slate">Which channels are you analyzing?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CHANNEL_IDS.map((ch) => {
            const on = active.includes(ch);
            return (
              <button type="button" key={ch} onClick={() => toggle(ch)} aria-pressed={on} className={`rounded-sm border px-3 py-1.5 text-xs font-semibold ${on ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink"}`}>
                {CHANNELS[ch].label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate">Pull these numbers from each platform&apos;s native analytics (last 30 days). Conversions = donations, signups, or RSVPs you attribute to the channel.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Per-channel analytics metrics from the last 30 days. Enter followers, posts, impressions, engagements, profile visits, link clicks, and conversions for each selected channel.</caption>
            <thead>
              <tr className="text-slate">
                <th className="py-1 pr-3 font-mono text-[0.6rem] uppercase tracking-eyebrow">Channel</th>
                {FIELDS.map((f) => (
                  <th key={f.key} className="px-2 py-1 font-mono text-[0.6rem] uppercase tracking-eyebrow">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map((ch) => (
                <tr key={ch} className="border-t border-line">
                  <td className="py-2 pr-3 font-semibold text-ink">
                    {CHANNELS[ch].label}
                    <input type="hidden" name="metricChannel" value={ch} />
                  </td>
                  {FIELDS.map((f) => (
                    <td key={f.key} className="px-2 py-1">
                      {/* Column <th>s don't programmatically name these inputs, so each
                          carries an explicit accessible name (channel + metric). */}
                      <input
                        type="number"
                        min={0}
                        name={`${ch}_${f.key}`}
                        aria-label={`${CHANNELS[ch].label} — ${f.label}`}
                        className={input}
                        defaultValue={0}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="submit" disabled={pending} className="btn-primary mt-4 disabled:opacity-50">
          {pending ? "Analyzing…" : "Analyze & optimize"}
        </button>
        {state.message && <p className="mt-3 text-sm text-brick">{state.message}</p>}
      </div>

      {history.length > 1 && (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-slate">Footprint index — trend</p>
            <span className="font-mono text-[0.6rem] text-slate">last {history.length} snapshots</span>
          </div>
          <div className="mt-4 flex items-end gap-1.5" style={{ height: 96 }}>
            {[...history].reverse().map((s, i) => (
              <div key={i} className="group relative flex flex-1 flex-col items-center justify-end" title={`${s.index}/100 · ${new Date(s.at).toLocaleDateString()}`}>
                <div className="w-full rounded-t-sm bg-gradient-to-t from-field to-gold" style={{ height: `${Math.max(3, s.index)}%` }} />
                <span className="mt-1 font-mono text-[0.55rem] text-slate">{s.index}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[0.6rem] text-slate">Oldest → newest. The trend line is the real measure of footprint domination.</p>
        </div>
      )}

      {report && (
        <>
          <div className="card p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-slate">Digital footprint index</p>
                <p className="mt-2 font-display text-5xl font-semibold text-ink">{report.index}<span className="text-2xl text-slate">/100</span></p>
              </div>
              <div className="text-right font-mono text-xs text-slate">
                <p>{report.totalFollowers.toLocaleString()} total followers</p>
                <p>{report.totalImpressions30d.toLocaleString()} impressions / 30d</p>
                <p>{report.totalConversions30d.toLocaleString()} conversions / 30d</p>
              </div>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-gradient-to-r from-field to-gold" style={{ width: `${report.index}%` }} />
            </div>
            <button type="submit" formAction={saveFootprintSnapshot} className="mt-3 rounded-sm border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink">
              Save snapshot to track the trend
            </button>
            {report.missingChannels.length > 0 && (
              <p className="mt-3 text-xs text-slate">
                Presence gaps — no data yet on: <span className="text-ink">{report.missingChannels.map((c) => CHANNELS[c].label).join(", ")}</span>. Each unclaimed channel caps the index.
              </p>
            )}
          </div>

          <div className="card p-6">
            <p className="eyebrow text-slate">Top moves</p>
            <ul className="mt-3 space-y-2">
              {report.topMoves.map((m, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className={`font-mono text-[0.6rem] uppercase ${priColor[m.priority]}`}>{m.priority}</span>
                  <span className="text-ink">{m.message}</span>
                </li>
              ))}
              {report.topMoves.length === 0 && <li className="text-sm text-field">Healthy across the board — keep the cadence and double down on your best-performing pillar.</li>}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {report.channels.map((c) => (
              <div key={c.channel} className="card p-5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHANNELS[c.channel].color }} />
                    {CHANNELS[c.channel].label}
                  </span>
                  <span className={`font-mono text-xs ${c.health >= 70 ? "text-field" : c.health >= 45 ? "text-gold-ink" : "text-brick"}`}>health {c.health}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[0.7rem] text-slate">
                  <div className="flex justify-between"><dt>Engagement</dt><dd className="text-ink">{c.engagementRate.toFixed(1)}%</dd></div>
                  <div className="flex justify-between"><dt>Amplify</dt><dd className="text-ink">{c.amplification.toFixed(2)}×</dd></div>
                  <div className="flex justify-between"><dt>Cadence</dt><dd className="text-ink">{c.cadencePerWeek.toFixed(1)}/wk</dd></div>
                  <div className="flex justify-between"><dt>Click-thru</dt><dd className="text-ink">{c.clickThrough.toFixed(1)}%</dd></div>
                  <div className="flex justify-between"><dt>Convert</dt><dd className="text-ink">{c.conversionRate.toFixed(1)}%</dd></div>
                </dl>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate">Thresholds are industry rules of thumb, not Matt-specific targets. Tune them in <span className="font-mono">lib/social/optimize.ts</span> as you learn what converts in MO-02.</p>
        </>
      )}
    </form>
  );
}
