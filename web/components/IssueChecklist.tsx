"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Issue } from "@/lib/issues";
import { STRATEGY_DISCLAIMER } from "@/lib/strategy/engine";

// Curated, always-on "here's how to help" checklist for an issue. Content is
// static (no AI) and comes from issue.checklist. Supporters can check items off;
// progress is saved only in this browser (localStorage) — nothing leaves the
// device, so no personal data is collected.
export function IssueChecklist({ issue }: { issue: Issue }) {
  const items = issue.checklist ?? [];
  const storageKey = `mg:checklist:${issue.slug}`;
  const [done, setDone] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load saved progress after mount so SSR + first client render both start
  // empty (no hydration mismatch), then reconcile from localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(JSON.parse(raw) as string[]);
    } catch {
      /* corrupt/unavailable storage — start fresh */
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(done));
    } catch {
      /* best-effort persistence */
    }
  }, [done, hydrated, storageKey]);

  if (items.length === 0) return null;

  const isDone = (t: string) => done.includes(t);
  const toggle = (t: string) => setDone((d) => (d.includes(t) ? d.filter((x) => x !== t) : [...d, t]));
  const completed = hydrated ? items.filter((it) => isDone(it.text)).length : 0;
  const pct = items.length ? Math.round((completed / items.length) * 100) : 0;

  return (
    <div className="card bg-white p-8">
      <p className="eyebrow text-field">Ways to help right now</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Your {issue.eyebrow} checklist</h2>
      <p className="mt-2 max-w-prose text-sm text-slate">
        Lawful, everyday ways to move this fight forward. Check them off as you go — your progress is saved on this device.
      </p>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-slate">
          <span>{hydrated ? `${completed} of ${items.length} done` : `${items.length} actions`}</span>
          {hydrated && completed > 0 && (
            <button type="button" onClick={() => setDone([])} className="underline hover:text-ink">
              Reset
            </button>
          )}
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-paper">
          <div className="h-full rounded-full bg-field transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="mt-5 space-y-2.5">
        {items.map((it) => {
          const checked = hydrated && isDone(it.text);
          return (
            <li key={it.text}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(it.text)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-field"
                />
                <span className={`text-sm ${checked ? "text-slate line-through" : "text-ink"}`}>
                  {it.href ? (
                    <Link href={it.href} className="underline decoration-line hover:text-brick">
                      {it.text}
                    </Link>
                  ) : (
                    it.text
                  )}
                  <span className="ml-2 rounded-sm bg-paper px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
                    {it.tag}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 border-t border-line pt-3 text-xs text-slate">
        Want a step-by-step plan for your area?{" "}
        <a href="#make-your-plan" className="underline hover:text-ink">
          Make your plan
        </a>{" "}
        below.
      </p>
      <p className="mt-2 text-xs text-slate">{STRATEGY_DISCLAIMER}</p>
    </div>
  );
}
