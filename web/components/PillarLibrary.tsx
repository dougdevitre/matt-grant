"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";

export type LibraryDoc = { slug: string; title: string };

// Split "Title — Subtitle" on an em-dash into a heading + supporting line. Most
// titles have no subtitle (they're just titles), so detail is usually undefined —
// the card degrades to title-only. No category is derived from titles: the data
// doesn't reliably support it (see the hub note); real categories will come from a
// manifest field.
function parse(title: string): { name: string; detail?: string } {
  const m = title.match(/^(.*?)\s+—\s+(.+)$/);
  return m ? { name: m[1], detail: m[2] } : { name: title };
}

// Client-side searchable index of a hub's guides. The hubs run large (business
// has 80+), so an instant title filter is the difference between scannable and a
// wall of links.
export function PillarLibrary({ pillarSlug, docs }: { pillarSlug: string; docs: LibraryDoc[] }) {
  const [q, setQ] = useState("");
  const inputId = useId();

  const all = useMemo(
    () => docs.map((d) => ({ ...d, ...parse(d.title) })).sort((a, b) => a.name.localeCompare(b.name)),
    [docs],
  );

  const term = q.trim().toLowerCase();
  const shown = term ? all.filter((d) => d.title.toLowerCase().includes(term)) : all;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor={inputId} className="sr-only">
          Search guides
        </label>
        <input
          id={inputId}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${all.length} guides…`}
          className="w-full rounded-sm border border-line bg-white px-4 py-2.5 text-ink placeholder:text-slate focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15 sm:max-w-sm"
        />
        <p aria-live="polite" className="font-mono text-xs uppercase tracking-eyebrow text-slate">
          {term ? `${shown.length} of ${all.length}` : `${all.length} guides`}
        </p>
      </div>

      {shown.length > 0 ? (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/pillars/${pillarSlug}/${d.slug}`}
                className="group flex h-full flex-col rounded-sm border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-ink hover:shadow-card motion-reduce:hover:translate-y-0"
              >
                <span className="font-display text-base font-semibold leading-snug text-ink group-hover:text-brick">
                  {d.name}
                </span>
                {d.detail && <span className="mt-1 text-sm leading-snug text-slate">{d.detail}</span>}
                <span className="mt-3 font-mono text-[11px] uppercase tracking-eyebrow text-slate">Guide →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-sm border border-line bg-white p-6 text-slate">
          No guides match &ldquo;{q.trim()}&rdquo;. Try a broader term.
        </p>
      )}
    </div>
  );
}
