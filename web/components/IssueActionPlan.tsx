"use client";

import { useEffect, useState } from "react";
import { LEVELS, type Level } from "@/lib/strategy/prompt";
import type { Cadence } from "@/lib/actions";
import type { StrategyResult } from "@/lib/strategy/engine";

// A lean, issue-scoped version of the /act smart-plan generator. Fixed to one
// issue; the visitor adds their area/zip/focus and gets an on-platform brief +
// action plan from the same /api/act/strategy engine. Reuses the act:prefs
// localStorage so area/zip set on /act carry over here, and vice versa.
const LEVEL_OPTION: Record<Level, string> = {
  county: "County",
  city: "City / town",
  "school-district": "School district",
};
const input = "mt-1 rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-field/30";

export function IssueActionPlan({ issueSlug, issueLabel }: { issueSlug: string; issueLabel: string }) {
  const [area, setArea] = useState("");
  const [zip, setZip] = useState("");
  const [level, setLevel] = useState<Level>("city");
  const [cadence] = useState<Cadence>("weekly");
  const [res, setRes] = useState<StrategyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("act:prefs") || "{}");
      if (typeof s.area === "string") setArea(s.area);
      if (typeof s.zip === "string") setZip(s.zip);
      if (LEVELS.includes(s.level)) setLevel(s.level);
    } catch {
      /* ignore */
    }
  }, []);

  async function generate() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/act/strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issueSlug, area, zip, level, cadence, depth: "public" }),
      });
      if (!r.ok) throw new Error("rate");
      setRes((await r.json()) as StrategyResult);
    } catch {
      setErr("Couldn't build your plan just now — please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6 sm:p-8">
      <p className="eyebrow text-brick">Your plan for this issue</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Turn {issueLabel} into action where you live</h2>
      <p className="mt-2 max-w-prose text-sm text-slate">
        Tell us your area and we&rsquo;ll build a short, practical plan you can act on now — grounded in
        Matt&rsquo;s platform, with no fabricated local details.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Where you live</span>
          <input value={area} onChange={(e) => { setArea(e.target.value); setRes(null); }} placeholder="Town or county" className={`${input} w-48`} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">ZIP <span className="font-normal text-slate">(optional)</span></span>
          <input value={zip} inputMode="numeric" maxLength={5} onChange={(e) => { setZip(e.target.value.replace(/\D/g, "").slice(0, 5)); setRes(null); }} placeholder="63017" className={`${input} w-28`} />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink">Focus</span>
        {LEVELS.map((lv) => (
          <button
            key={lv}
            onClick={() => { setLevel(lv); setRes(null); }}
            className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${level === lv ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-ink"}`}
          >
            {LEVEL_OPTION[lv]}
          </button>
        ))}
        <button onClick={generate} disabled={loading} className="btn-primary ml-auto disabled:opacity-50">
          {loading ? "Building…" : "Build my plan"}
        </button>
      </div>
      {err && <p className="mt-3 text-xs text-brick">{err}</p>}

      {res && (
        <div className="mt-6">
          {res.brief.length > 0 && (
            <div className="space-y-3 border-l-2 border-gold/60 pl-4">
              {res.brief.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-ink">{p}</p>
              ))}
            </div>
          )}
          <div className="mt-6 space-y-5">
            {res.actions.map((d) => (
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
          <p className="mt-5 border-t border-line pt-3 text-xs text-slate">
            {res.disclaimer} · <a href="/act" className="underline hover:text-ink">Build a full action plan →</a>
          </p>
        </div>
      )}
    </div>
  );
}
