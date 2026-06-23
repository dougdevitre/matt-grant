"use client";

import { useActionState, useMemo, useState } from "react";
import { importVolunteers, type ImportState } from "@/app/dashboard/volunteers/actions";
import { parseCsv, mapVolunteers } from "@/lib/contacts/import";

// Paste-a-spreadsheet volunteer import. The same pure parser runs client-side for
// a live preview before the server action writes anything.
export function VolunteerImport() {
  const [state, action, pending] = useActionState<ImportState | null, FormData>(importVolunteers, null);
  const [text, setText] = useState("");
  const preview = useMemo(() => mapVolunteers(parseCsv(text)), [text]);
  const hasInput = text.trim().length > 0;

  return (
    <details className="card mb-6 p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between">
        <span>
          <span className="font-semibold text-ink">Import volunteers</span>
          <span className="ml-2 text-xs text-slate">paste a CSV from a spreadsheet</span>
        </span>
        <span className="font-mono text-[0.65rem] uppercase tracking-eyebrow text-field">CSV ▾</span>
      </summary>

      <form action={action} className="mt-4 space-y-3">
        <p className="text-xs text-slate">
          First row must be a header. Recognized columns: <span className="font-mono">name</span>, <span className="font-mono">email</span>,{" "}
          <span className="font-mono">phone</span>, <span className="font-mono">city</span>, <span className="font-mono">interests</span>. Each row needs a{" "}
          <span className="font-semibold">name</span> and an <span className="font-semibold">email or phone</span>. Re-importing a known email/phone updates that
          person instead of duplicating.
        </p>
        <textarea
          name="csv"
          aria-label="Volunteer CSV to import"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={"name,email,phone,city,interests\nJane Doe,jane@example.com,314-555-0100,Kirkwood,canvass;phones\nSam Lee,sam@example.com,,Ballwin,signs"}
          className="w-full rounded-sm border border-line bg-white px-3 py-2 font-mono text-xs text-ink focus:border-field"
        />

        {hasInput && (
          <p className="text-xs text-slate">
            Preview: <span className="font-semibold text-field">{preview.valid.length} ready</span>
            {preview.skipped > 0 && <span className="text-[#9a6f1a]"> · {preview.skipped} skipped (missing name or contact)</span>}
            {preview.mappedColumns.length > 0 && <span className="text-slate"> · columns: {preview.mappedColumns.join(", ")}</span>}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending || preview.valid.length === 0} className="btn-primary disabled:opacity-50">
            {pending ? "Importing…" : `Import ${preview.valid.length || ""} volunteer${preview.valid.length === 1 ? "" : "s"}`.trim()}
          </button>
          <span className="text-[0.7rem] text-slate">Only import people who agreed to be contacted.</span>
        </div>

        {state && (
          <p className={`rounded-sm border px-3 py-2 text-sm ${state.ok ? "border-field/40 bg-field/10 text-field" : "border-brick/40 bg-brick/10 text-brick"}`}>
            {state.message}
          </p>
        )}
      </form>
    </details>
  );
}
