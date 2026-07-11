"use client";

import { useActionState, useMemo, useState } from "react";
import { parseCsv } from "@/lib/contacts/import";
import { mapReturnRows } from "@/lib/voters/chase";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { importBallotReturnsAction, type ActionState } from "@/app/dashboard/voters/actions";

// Daily early-vote/absentee returns import (voter-file-plan.md Phase 5 +
// tactics/ballot-chase-program.md §data-acquisition): paste the county file,
// preview what maps client-side, import. Idempotent — a cumulative daily file
// re-imports safely; only NEW voter ids bank. The page revalidates after
// import, so the report above refreshes in place.

const IDLE: ActionState = { ok: true, message: "" };

export function ReturnsImport() {
  const [text, setText] = useState("");
  const [state, action] = useActionState(importBallotReturnsAction, IDLE);
  const preview = useMemo(() => (text.trim() ? mapReturnRows(parseCsv(text)) : null), [text]);

  return (
    <div className="card p-5 no-print">
      <p className="font-display text-lg text-ink">Import today&apos;s returns file</p>
      <p className="mt-1 max-w-3xl text-sm text-slate">
        Paste the county&apos;s early-vote / absentee-returns export. Only a{" "}
        <span className="font-mono">voter_id</span> column is required (<span className="font-mono">voted_date</span>{" "}
        and <span className="font-mono">method</span> pass through when present). Re-importing a cumulative file is
        safe — already-banked voters are skipped, never double-counted. Unmatched ids are reported, not guessed.
      </p>
      <form action={action} className="mt-3 grid gap-2">
        <textarea
          name="csv"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={"voter_id,voted_date,method\n123456,2026-07-21,In-person absentee"}
          className="w-full rounded-sm border border-line bg-white p-2 font-mono text-xs text-ink"
          aria-label="Ballot returns CSV"
        />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton className="btn-ghost px-3 py-1 text-xs disabled:opacity-50" disabled={!preview?.valid.length} pendingText="Importing…">
            Import {preview?.valid.length ? `${preview.valid.length.toLocaleString()} returns` : ""}
          </SubmitButton>
          {preview && (
            <span className="text-xs text-slate">
              {preview.valid.length.toLocaleString()} usable · {preview.skipped.toLocaleString()} without a voter id of{" "}
              {preview.total.toLocaleString()}
            </span>
          )}
        </div>
        {state.message && (
          <p className={`text-xs ${state.ok ? "text-field" : "text-brick"}`} role="status">
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
