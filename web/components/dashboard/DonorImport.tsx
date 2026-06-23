"use client";

import { useActionState, useMemo, useState } from "react";
import { importDonors, type DonorImportState } from "@/app/dashboard/donors/actions";
import { parseCsv, mapDonors } from "@/lib/contacts/import";

// Paste-a-spreadsheet donor import. Same pure parser runs client-side for a live
// preview; the server action funnels rows through the FEC-aware recordContribution.
export function DonorImport() {
  const [state, action, pending] = useActionState<DonorImportState | null, FormData>(importDonors, null);
  const [text, setText] = useState("");
  const preview = useMemo(() => mapDonors(parseCsv(text)), [text]);
  const hasInput = text.trim().length > 0;
  const withAmount = preview.valid.filter((d) => d.amountCents).length;

  return (
    <details className="card mb-6 p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between">
        <span>
          <span className="font-semibold text-ink">Import donors</span>
          <span className="ml-2 text-xs text-slate">paste a CSV from a spreadsheet</span>
        </span>
        <span className="font-mono text-[0.65rem] uppercase tracking-eyebrow text-field">CSV ▾</span>
      </summary>

      <form action={action} className="mt-4 space-y-3">
        <p className="text-xs text-slate">
          First row must be a header. Recognized columns: <span className="font-mono">name</span>, <span className="font-mono">email</span>,{" "}
          <span className="font-mono">city</span>, <span className="font-mono">state</span>, <span className="font-mono">zip</span>,{" "}
          <span className="font-mono">employer</span>, <span className="font-mono">occupation</span>, <span className="font-mono">amount</span>. Each row needs a{" "}
          <span className="font-semibold">name</span>; <span className="font-mono">amount</span> is optional. Include <span className="font-mono">email</span> so returning donors
          merge onto one record (FEC <span className="font-semibold">employer/occupation</span> are required over $200/cycle).
        </p>
        <textarea
          name="csv"
          aria-label="Donor CSV to import"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={"name,email,city,employer,occupation,amount\nJane Doe,jane@example.com,Kirkwood,Acme Inc,Engineer,250\nSam Lee,sam@example.com,Ballwin,,,50"}
          className="w-full rounded-sm border border-line bg-white px-3 py-2 font-mono text-xs text-ink focus:border-field"
        />

        {hasInput && (
          <p className="text-xs text-slate">
            Preview: <span className="font-semibold text-field">{preview.valid.length} ready</span>
            {withAmount > 0 && <span className="text-slate"> · {withAmount} with an amount</span>}
            {preview.skipped > 0 && <span className="text-[#9a6f1a]"> · {preview.skipped} skipped (missing name)</span>}
            {preview.mappedColumns.length > 0 && <span className="text-slate"> · columns: {preview.mappedColumns.join(", ")}</span>}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending || preview.valid.length === 0} className="btn-primary disabled:opacity-50">
            {pending ? "Importing…" : `Import ${preview.valid.length || ""} donor${preview.valid.length === 1 ? "" : "s"}`.trim()}
          </button>
          <span className="text-[0.7rem] text-slate">Reconcile against committee records.</span>
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
