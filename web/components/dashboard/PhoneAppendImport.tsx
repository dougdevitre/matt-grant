"use client";

import { useActionState, useMemo, useState } from "react";
import { parseCsv } from "@/lib/contacts/import";
import { mapAppendRows } from "@/lib/voters/phoneAppend";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { importAppendedPhonesAction, type ActionState } from "@/app/dashboard/voters/actions";

// Vendor phone-append import (voter-file-plan.md §6): paste the purchased
// append CSV, preview what maps client-side (the DonorImport pattern — the same
// pure mapper runs in the browser and in the action), then import. Appended
// numbers feed MANUAL-DIAL call sheets/CSVs only — never SMS (TCPA: broadcast
// texting stays gated on the person's own opt-in in the consent ledger).

const IDLE: ActionState = { ok: true, message: "" };

export function PhoneAppendImport() {
  const [text, setText] = useState("");
  const [state, action] = useActionState(importAppendedPhonesAction, IDLE);
  const preview = useMemo(() => (text.trim() ? mapAppendRows(parseCsv(text)) : null), [text]);

  return (
    <details className="mt-6 card p-5">
      <summary className="cursor-pointer select-none font-display text-lg text-ink">
        Phone append import <span className="ml-2 font-sans text-xs text-slate">(vendor file → call sheets)</span>
      </summary>
      <p className="mt-2 max-w-3xl text-sm text-slate">
        Bought a phone-append file? Paste it here. Each row needs a <span className="font-mono">phone</span> plus
        either the <span className="font-mono">voter_id</span> (best — exact match) or a{" "}
        <span className="font-mono">name</span> + 5-digit <span className="font-mono">zip</span>. Appended numbers
        appear on call lists and call sheets as <strong>manual-dial only — they are never texted</strong>; texting
        stays opt-in-only via the consent ledger.
      </p>
      <form action={action} className="mt-3 grid gap-2">
        <textarea
          name="csv"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={"voter_id,name,zip,phone,source\n123456,\"Sample, Alex\",63011,(314) 555-0100,vendor-x"}
          className="w-full rounded-sm border border-line bg-white p-2 font-mono text-xs text-ink"
          aria-label="Phone append CSV"
        />
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            name="source"
            placeholder="Source label (e.g. vendor name)"
            className="rounded-sm border border-line bg-white px-2 py-1 text-xs text-ink"
            aria-label="Append source label"
          />
          <SubmitButton className="btn-ghost px-3 py-1 text-xs disabled:opacity-50" disabled={!preview?.valid.length} pendingText="Importing…">
            Import {preview?.valid.length ? `${preview.valid.length.toLocaleString()} rows` : ""}
          </SubmitButton>
          {preview && (
            <span className="text-xs text-slate">
              {preview.valid.length.toLocaleString()} usable · {preview.skipped.length.toLocaleString()} skipped of{" "}
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
    </details>
  );
}
