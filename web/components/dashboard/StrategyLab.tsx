"use client";

import { useState } from "react";
import { ISSUES } from "@/lib/issues";
import { AREA_SUGGESTIONS, type Cadence } from "@/lib/actions";
import { LEVELS, type Level } from "@/lib/strategy/prompt";
import type { StrategyResult } from "@/lib/strategy/engine";

const LEVEL_OPTION: Record<Level, string> = {
  county: "County",
  city: "City / town",
  "school-district": "School district",
};

// Gated, deeper sibling of the public /act smart plan. Signed-in staff/partners
// generate the FULL strategy (multi-paragraph brief + fuller plan) for any of the
// four documented priorities, tailored to a county / city / school-district focus.
export function StrategyLab() {
  const [area, setArea] = useState("");
  const [issueSlug, setIssueSlug] = useState(ISSUES[0].slug);
  const [level, setLevel] = useState<Level>("county");
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function generate() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/act/strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issueSlug, area, level, cadence, depth: "full" }),
      });
      if (!res.ok) throw new Error("failed");
      setResult((await res.json()) as StrategyResult);
    } catch {
      setErr("Couldn't generate the strategy just now — try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card mt-10 p-6">
      <p className="eyebrow text-brick">Strategy lab</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Build a responsible-governance strategy</h2>
      <p className="mt-2 max-w-prose text-sm text-slate">
        Generate a deeper brief and action plan for one of the four priorities, tailored to a county,
        city, or school-district focus. Grounded in Matt&rsquo;s documented platform — no invented
        positions, statistics, or local specifics.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Priority</span>
          <select
            value={issueSlug}
            onChange={(e) => {
              setIssueSlug(e.target.value);
              setResult(null);
            }}
            className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-field/30"
          >
            {ISSUES.map((i) => (
              <option key={i.slug} value={i.slug}>{i.eyebrow} — {i.title}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">Area</span>
          <input
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setResult(null);
            }}
            placeholder="Town, city, county, or school district"
            className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-field/30"
          />
          <span className="mt-2 flex flex-wrap gap-1.5">
            {AREA_SUGGESTIONS.slice(0, 6).map((a) => (
              <button key={a} onClick={() => { setArea(a); setResult(null); }} className="rounded-sm border border-line px-2 py-0.5 text-[0.65rem] text-slate hover:border-ink">
                {a}
              </button>
            ))}
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-ink">Focus level</span>
        {LEVELS.map((lv) => (
          <button
            key={lv}
            onClick={() => { setLevel(lv); setResult(null); }}
            className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${level === lv ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-ink"}`}
          >
            {LEVEL_OPTION[lv]}
          </button>
        ))}
        <span className="ml-2 text-xs font-semibold text-ink">Plan</span>
        {(["daily", "weekly"] as Cadence[]).map((c) => (
          <button
            key={c}
            onClick={() => { setCadence(c); setResult(null); }}
            className={`rounded-sm border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${cadence === c ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-ink"}`}
          >
            {c}
          </button>
        ))}
        <button onClick={generate} disabled={loading} className="btn-primary ml-auto disabled:opacity-50">
          {loading ? "Building…" : "Generate strategy"}
        </button>
      </div>
      {err && <p className="mt-3 text-xs text-brick">{err}</p>}

      {result && (
        <article className="mt-7 border-t border-line pt-6">
          <p className="text-sm text-slate">
            <strong className="text-ink">{result.issueEyebrow}</strong> · {LEVEL_OPTION[result.level].toLowerCase()} focus ·{" "}
            <span className="font-mono text-xs uppercase tracking-eyebrow">{result.source === "ai" ? "AI" : "curated"}</span>
          </p>

          <div className="mt-4 space-y-3 border-l-2 border-gold/60 pl-4">
            {result.brief.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-ink">{p}</p>
            ))}
          </div>

          <div className="mt-7 space-y-6">
            {result.actions.map((d) => (
              <section key={d.label}>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs font-bold uppercase tracking-eyebrow text-field">{d.label}</span>
                  <span className="font-display text-base font-semibold text-ink">{d.theme}</span>
                </div>
                <ul className="mt-2 space-y-2">
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

          <p className="mt-7 border-t border-line pt-4 text-xs text-slate">{result.disclaimer}</p>
        </article>
      )}
    </div>
  );
}
