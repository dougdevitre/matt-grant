"use client";

import { useMemo, useState } from "react";
import { ISSUES } from "@/lib/issues";
import { buildAgenda, AREA_SUGGESTIONS, type Cadence } from "@/lib/actions";
import { CAMPAIGN, ASSETS_CDN } from "@/lib/site";

export function AgendaBuilder() {
  const [area, setArea] = useState("");
  const [issueSlug, setIssueSlug] = useState(ISSUES[0].slug);
  const [cadence, setCadence] = useState<Cadence>("weekly");

  const agenda = useMemo(() => buildAgenda(area, issueSlug, cadence), [area, issueSlug, cadence]);
  const issue = ISSUES.find((i) => i.slug === issueSlug)!;

  return (
    <div className="mt-8">
      {/* Controls (hidden when printing) */}
      <div className="no-print card p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-ink">Where you live</span>
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Your town or county"
              className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            />
            <span className="mt-2 flex flex-wrap gap-1.5">
              {AREA_SUGGESTIONS.slice(0, 6).map((a) => (
                <button key={a} onClick={() => setArea(a)} className="rounded-sm border border-line px-2 py-0.5 text-[0.65rem] text-slate hover:border-ink">
                  {a}
                </button>
              ))}
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink">The fight you'll champion</span>
            <select
              value={issueSlug}
              onChange={(e) => setIssueSlug(e.target.value)}
              className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            >
              {ISSUES.map((i) => (
                <option key={i.slug} value={i.slug}>{i.eyebrow} — {i.title}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-ink">Plan length</span>
          {(["daily", "weekly"] as Cadence[]).map((c) => (
            <button
              key={c}
              onClick={() => setCadence(c)}
              className={`rounded-sm border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${cadence === c ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-ink"}`}
            >
              {c}
            </button>
          ))}
          <button onClick={() => window.print()} className="btn-primary ml-auto">Print / Save as PDF</button>
        </div>
      </div>

      {/* The printable plan */}
      <article className="printable mt-8 rounded-lg border border-line bg-white p-8 shadow-card sm:p-10">
        <header className="flex items-center justify-between border-b border-line pb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ASSETS_CDN}/public/brand/logo.png`} alt="Matt Grant for Congress" className="h-9 w-auto" />
          <span className="font-mono text-[0.65rem] uppercase tracking-eyebrow text-slate">Primary · {CAMPAIGN.electionLabel}</span>
        </header>

        <p className="eyebrow mt-6 text-brick">My campaign action plan</p>
        <h2 className="mt-2 font-display text-3xl font-semibold text-ink">
          {cadence === "daily" ? "Today's actions" : "This week's actions"}
        </h2>
        <p className="mt-2 text-slate">
          For <strong className="text-ink">{agenda.area}</strong> · championing{" "}
          <strong className="text-ink">{issue.eyebrow}</strong> — every action builds awareness for August 4.
        </p>

        <div className="mt-8 space-y-7">
          {agenda.days.map((d) => (
            <section key={d.label}>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs font-bold uppercase tracking-eyebrow text-field">{d.label}</span>
                <span className="font-display text-lg font-semibold text-ink">{d.theme}</span>
              </div>
              <ul className="mt-3 space-y-2.5">
                {d.items.map((it, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-[3px] border-2 border-slate" aria-hidden />
                    <span className="text-sm text-ink">
                      {it.text}
                      <span className="ml-2 rounded-sm bg-paper px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">{it.tag}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="mt-9 border-t border-line pt-5">
          <p className="font-display text-base font-semibold text-ink">Vote Matt Grant · August 4, 2026</p>
          <p className="mt-1 text-xs text-slate">mattgrantforcongress.org · {CAMPAIGN.paidForBy}</p>
        </footer>
      </article>
    </div>
  );
}
