"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { setCaptainRegionsAction } from "@/app/dashboard/team/actions";

// Admin control on the Team page: assign a captain to one or more canonical
// geographic regions (Airtable Geo Hierarchy). Replaces the free-text area for
// splittable, mappable coverage. A collapsed <details> keeps the row compact; the
// summary shows the live count. Submitting with nothing checked clears the
// assignment (the action treats an empty selection as REMOVE).
export function CaptainRegionsPicker({
  email,
  options,
  selected,
}: {
  email: string;
  options: { name: string; level: string }[];
  selected: string[];
}) {
  const sel = new Set(selected.map((s) => s.trim().toLowerCase()));
  const [count, setCount] = useState(selected.length);

  if (options.length === 0) {
    return (
      <span className="text-[0.65rem] text-slate" title="No regions found in the Airtable Geo Hierarchy">
        No regions configured
      </span>
    );
  }

  return (
    <details className="group relative">
      <summary className="cursor-pointer list-none rounded-sm border border-line px-2.5 py-1 text-xs text-slate hover:border-ink hover:text-ink">
        Regions{count > 0 ? ` · ${count}` : ""}
      </summary>
      <form
        action={setCaptainRegionsAction}
        className="absolute right-0 z-10 mt-1 w-64 rounded-sm border border-line bg-paper p-3 shadow-lg"
        onChange={(e) => {
          const f = e.currentTarget;
          setCount(f.querySelectorAll<HTMLInputElement>('input[name="region"]:checked').length);
        }}
      >
        <input type="hidden" name="email" value={email} />
        <fieldset className="max-h-56 overflow-auto">
          <legend className="sr-only">Regions for {email}</legend>
          {options.map((o) => (
            <label key={o.name} className="flex items-center gap-2 py-1 text-xs text-ink">
              <input
                type="checkbox"
                name="region"
                value={o.name}
                defaultChecked={sel.has(o.name.trim().toLowerCase())}
                className="accent-brick"
              />
              <span className="flex-1">{o.name}</span>
              <span className="font-mono text-[0.55rem] uppercase tracking-eyebrow text-slate">{o.level}</span>
            </label>
          ))}
        </fieldset>
        <div className="mt-2 flex justify-end">
          <SubmitButton
            pendingText="Saving…"
            className="rounded-sm border border-line px-2.5 py-1 text-xs text-slate hover:border-ink hover:text-ink disabled:opacity-50"
          >
            Save regions
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}
