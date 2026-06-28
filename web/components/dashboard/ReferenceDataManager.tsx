"use client";

import { useActionState, useState } from "react";
import type { RefTableSpec, RefField } from "@/lib/volunteer/reference-specs";
import type { RefRow } from "@/lib/airtable/reference-data";
import { createRef, updateRef, removeRef, type RefResult } from "@/app/dashboard/tasks/reference/actions";

const field = "rounded border border-slate/30 px-2 py-1 text-sm";

export type RefSection = {
  spec: RefTableSpec;
  rows: RefRow[];
  access: { create: boolean; update: boolean; delete: boolean };
};

function FieldInput({ f, value }: { f: RefField; value?: string }) {
  if (f.type === "select") {
    return (
      <select name={f.key} defaultValue={value ?? ""} className={`mt-1 block w-full ${field}`}>
        <option value="">—</option>
        {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (f.type === "longtext") {
    return <textarea name={f.key} defaultValue={value} rows={2} className={`mt-1 block w-full ${field}`} />;
  }
  if (f.type === "number" || f.type === "percent") {
    return (
      <input
        type="number"
        name={f.key}
        defaultValue={value}
        step={f.type === "percent" ? "0.1" : "1"}
        className={`mt-1 block w-full ${field}`}
      />
    );
  }
  return <input name={f.key} defaultValue={value} required={f.required} className={`mt-1 block w-full ${field}`} />;
}

function RowForm({ spec, row, onDone }: { spec: RefTableSpec; row?: RefRow; onDone: () => void }) {
  const action = row ? updateRef : createRef;
  const [res, formAction, busy] = useActionState<RefResult | null, FormData>(action, null);
  return (
    <form action={formAction} className="grid gap-3 p-3 sm:grid-cols-2">
      <input type="hidden" name="specId" value={spec.id} />
      {row && <input type="hidden" name="id" value={row.id} />}
      {spec.fields.map((f) => (
        <label key={f.key} className={`text-xs text-slate ${f.type === "longtext" ? "sm:col-span-2" : ""}`}>
          {f.label}
          <FieldInput f={f} value={row?.values[f.key]} />
        </label>
      ))}
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className="btn-ghost px-3 py-1 text-xs disabled:opacity-50">
          {busy ? "Saving…" : row ? "Save" : "Add"}
        </button>
        <button type="button" onClick={onDone} className="btn-ghost px-3 py-1 text-xs">{row ? "Cancel" : "Close"}</button>
        {res && <span className={`text-xs ${res.ok ? "text-emerald-700" : "text-red-600"}`}>{res.message}</span>}
      </div>
    </form>
  );
}

function DeleteForm({ specId, id }: { specId: string; id: string }) {
  const [res, action, busy] = useActionState<RefResult | null, FormData>(removeRef, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="specId" value={specId} />
      <input type="hidden" name="id" value={id} />
      <button disabled={busy} className="btn-ghost px-2 py-0.5 text-xs text-red-600 disabled:opacity-50">
        {busy ? "…" : "Delete"}
      </button>
      {res && !res.ok && <span className="ml-2 text-xs text-red-600">{res.message}</span>}
    </form>
  );
}

function RowItem({ spec, row, editable }: { spec: RefTableSpec; row: RefRow; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return <div className="rounded bg-slate/5"><RowForm spec={spec} row={row} onDone={() => setEditing(false)} /></div>;
  }
  const [title, ...rest] = spec.fields;
  const meta = rest.map((f) => row.values[f.key]).filter(Boolean).join(" · ");
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate/10 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{row.values[title.key]}</p>
        {meta && <p className="text-xs text-slate/70">{meta}</p>}
      </div>
      {editable && (
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => setEditing(true)} className="btn-ghost px-2 py-0.5 text-xs">Edit</button>
          <DeleteForm specId={spec.id} id={row.id} />
        </div>
      )}
    </div>
  );
}

function Section({ section }: { section: RefSection }) {
  const { spec, rows, access } = section;
  const [creating, setCreating] = useState(false);
  const canEdit = access.update || access.delete;
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">{spec.label}</h2>
          <p className="text-xs text-slate/70">{spec.blurb}</p>
        </div>
        {access.create && !creating && (
          <button onClick={() => setCreating(true)} className="btn-ghost shrink-0 px-2.5 py-1 text-xs">+ New</button>
        )}
      </div>
      <div className="card overflow-hidden">
        {access.create && creating && (
          <div className="border-b border-slate/10 bg-slate/5"><RowForm spec={spec} onDone={() => setCreating(false)} /></div>
        )}
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate">No {spec.label.toLowerCase()} yet.</p>
        ) : (
          rows.map((r) => <RowItem key={r.id} spec={spec} row={r} editable={canEdit} />)
        )}
      </div>
    </section>
  );
}

export function ReferenceDataManager({ sections }: { sections: RefSection[] }) {
  return (
    <div>
      {sections.map((s) => (
        <Section key={s.spec.id} section={s} />
      ))}
    </div>
  );
}
