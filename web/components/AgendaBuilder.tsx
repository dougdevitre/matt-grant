"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ISSUES } from "@/lib/issues";
import { buildAgenda, AREA_SUGGESTIONS, SCHOOL_DISTRICT_SUGGESTIONS, type Cadence, type AgendaDay } from "@/lib/actions";
import { CAMPAIGN, ASSETS_CDN } from "@/lib/site";
import { LEVELS, type Level } from "@/lib/strategy/prompt";
import type { StrategyResult } from "@/lib/strategy/engine";

const LEVEL_OPTION: Record<Level, string> = {
  county: "County",
  city: "City / town",
  "school-district": "School district",
};

export function AgendaBuilder() {
  const [area, setArea] = useState("");
  const [zip, setZip] = useState("");
  const [issueSlug, setIssueSlug] = useState(ISSUES[0].slug);
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [level, setLevel] = useState<Level>("city");

  // AI result (when generated); cleared whenever an input changes so we never
  // show a plan that no longer matches the controls.
  const [ai, setAi] = useState<StrategyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Remember where/what a returning visitor entered, so the page feels personal
  // without any login. Load once on mount; save on change.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("act:prefs") || "{}");
      if (typeof s.area === "string") setArea(s.area);
      if (typeof s.zip === "string") setZip(s.zip);
      if (LEVELS.includes(s.level)) setLevel(s.level);
    } catch {
      /* ignore unreadable storage */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("act:prefs", JSON.stringify({ area, zip, level }));
    } catch {
      /* ignore */
    }
  }, [area, zip, level]);

  function reset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setAi(null);
      setErr("");
    };
  }

  const agenda = useMemo(() => buildAgenda(area, issueSlug, cadence), [area, issueSlug, cadence]);
  const issue = ISSUES.find((i) => i.slug === issueSlug)!;

  const days: AgendaDay[] = ai?.actions ?? agenda.days;
  const brief: string[] = ai?.brief ?? [];
  const displayArea = (area || "your area").trim();
  // Quick-picks follow the focus level: districts when "school district" is
  // chosen, otherwise the common MO-02 municipalities.
  const suggestions = level === "school-district" ? SCHOOL_DISTRICT_SUGGESTIONS : AREA_SUGGESTIONS;

  async function generate() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/act/strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issueSlug, area, level, cadence, zip, depth: "public" }),
      });
      if (!res.ok) throw new Error("rate");
      setAi((await res.json()) as StrategyResult);
    } catch {
      setErr("Couldn't build the smart plan just now — your checklist below still works.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      {/* Controls (hidden when printing) */}
      <div className="no-print card p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block">
              <span className="text-xs font-semibold text-ink">Where you live</span>
              <input
                value={area}
                onChange={(e) => reset(setArea)(e.target.value)}
                placeholder="Your town or county"
                className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-field/30"
              />
            </label>
            <span className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.slice(0, 6).map((a) => (
                <button key={a} onClick={() => reset(setArea)(a)} className="rounded-sm border border-line px-2 py-0.5 text-[0.65rem] text-slate hover:border-ink">
                  {a}
                </button>
              ))}
            </span>
            <label className="mt-3 block">
              <span className="text-xs font-semibold text-ink">ZIP code <span className="font-normal text-slate">(optional — sharpens your plan)</span></span>
              <input
                value={zip}
                inputMode="numeric"
                maxLength={5}
                onChange={(e) => reset(setZip)(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="e.g. 63017"
                className="mt-1 w-full max-w-[10rem] rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-field/30"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-ink">The fight you&rsquo;ll champion</span>
            <select
              value={issueSlug}
              onChange={(e) => reset(setIssueSlug)(e.target.value)}
              className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-field/30"
            >
              {ISSUES.map((i) => (
                <option key={i.slug} value={i.slug}>{i.eyebrow} — {i.title}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-ink">Focus level</span>
          {LEVELS.map((lv) => (
            <button
              key={lv}
              onClick={() => reset(setLevel)(lv)}
              className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${level === lv ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-ink"}`}
            >
              {LEVEL_OPTION[lv]}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-ink">Plan length</span>
          {(["daily", "weekly"] as Cadence[]).map((c) => (
            <button
              key={c}
              onClick={() => reset(setCadence)(c)}
              className={`rounded-sm border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${cadence === c ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-ink"}`}
            >
              {c}
            </button>
          ))}
          <button onClick={generate} disabled={loading} className="btn-ink ml-auto disabled:opacity-50">
            {loading ? "Building…" : "Generate smart plan"}
          </button>
          <button onClick={() => window.print()} className="btn-primary">Print / Save as PDF</button>
        </div>
        {err && <p className="mt-3 text-xs text-brick">{err}</p>}
        <p className="mt-3 text-xs text-slate">
          The smart plan tailors a short brief + actions to your {LEVEL_OPTION[level].toLowerCase()} using AI, grounded in
          Matt&rsquo;s four priorities. Want the deeper county / city / school-district strategy?{" "}
          <Link href="/dashboard/peace-room" className="underline hover:text-ink">Open the Peace Room →</Link>
        </p>
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
          For <strong className="text-ink">{displayArea}</strong>{" "}
          <span className="font-mono text-xs uppercase tracking-eyebrow text-slate">({LEVEL_OPTION[level]} focus{zip ? ` · ${zip}` : ""})</span> · championing{" "}
          <strong className="text-ink">{issue.eyebrow}</strong> — every action builds awareness for August 4.
        </p>

        {brief.length > 0 && (
          <div className="mt-6 space-y-3 border-l-2 border-gold/60 pl-4">
            {brief.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-ink">{p}</p>
            ))}
          </div>
        )}

        <div className="mt-8 space-y-7">
          {days.map((d) => (
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
                      {it.href ? (
                        <a
                          href={it.href}
                          target={it.href.startsWith("http") ? "_blank" : undefined}
                          rel={it.href.startsWith("http") ? "noopener noreferrer" : undefined}
                          className="underline decoration-line underline-offset-2 hover:text-brick"
                        >
                          {it.text}
                        </a>
                      ) : (
                        it.text
                      )}
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
          <p className="mt-1 text-xs text-slate">
            {ai ? `${ai.disclaimer} · ` : ""}mattgrantforcongress.org · {CAMPAIGN.paidForBy}
          </p>
        </footer>
      </article>
    </div>
  );
}
