"use client";

import { useActionState, useState } from "react";
import {
  TT_STATUS, TT_PRIORITY, TT_MODE, TT_GEO, TT_EFFORT, TT_PHASE, TT_PASS,
} from "@/lib/volunteer/task-template-options";
import type { AdminTaskTemplate } from "@/lib/volunteer/task-templates-admin";
import { createTemplate, updateTemplate, removeTemplate, type TemplateResult } from "@/app/dashboard/tasks/templates/actions";

const STATUS_TONE: Record<string, string> = {
  Active: "bg-green-100 text-green-800",
  Draft: "bg-yellow-100 text-yellow-900",
  Archived: "bg-slate/10 text-slate",
};
const PRIORITY_TONE: Record<string, string> = {
  High: "text-red-600",
  Medium: "text-yellow-700",
  Low: "text-slate",
};

const field = "rounded border border-slate/30 px-2 py-1 text-sm";

function Select({ name, value, options, blank }: { name: string; value?: string; options: readonly string[]; blank?: boolean }) {
  return (
    <select name={name} defaultValue={value ?? (blank ? "" : options[0])} className={`mt-1 block w-full ${field}`}>
      {blank && <option value="">—</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// Shared create/edit form. `tpl` undefined = create mode.
function TemplateForm({ tpl, onDone }: { tpl?: AdminTaskTemplate; onDone: () => void }) {
  const action = tpl ? updateTemplate : createTemplate;
  const [res, formAction, busy] = useActionState<TemplateResult | null, FormData>(action, null);
  return (
    <form action={formAction} className="grid gap-3 p-4 sm:grid-cols-2">
      {tpl && <input type="hidden" name="id" value={tpl.id} />}
      <label className="text-xs text-slate sm:col-span-2">
        Task Name
        <input name="name" defaultValue={tpl?.name} required className={`mt-1 block w-full ${field}`} />
      </label>
      <label className="text-xs text-slate sm:col-span-2">
        What They Do
        <textarea name="whatTheyDo" defaultValue={tpl?.whatTheyDo} rows={2} className={`mt-1 block w-full ${field}`} />
      </label>
      <label className="text-xs text-slate">Status<Select name="status" value={tpl?.status} options={TT_STATUS} /></label>
      <label className="text-xs text-slate">Priority<Select name="priority" value={tpl?.priority} options={TT_PRIORITY} /></label>
      <label className="text-xs text-slate">Participation Mode<Select name="mode" value={tpl?.mode} options={TT_MODE} blank /></label>
      <label className="text-xs text-slate">Geo Scope<Select name="geo" value={tpl?.geo} options={TT_GEO} blank /></label>
      <label className="text-xs text-slate">Effort<Select name="effort" value={tpl?.effort} options={TT_EFFORT} blank /></label>
      <label className="text-xs text-slate">Campaign Phase<Select name="phase" value={tpl?.phase} options={TT_PHASE} blank /></label>
      <label className="text-xs text-slate sm:col-span-2">Contact Pass Type<Select name="pass" value={tpl?.pass} options={TT_PASS} blank /></label>
      <label className="text-xs text-slate sm:col-span-2">
        Instructions
        <textarea name="instructions" defaultValue={tpl?.instructions} rows={2} className={`mt-1 block w-full ${field}`} />
      </label>
      <label className="text-xs text-slate sm:col-span-2">
        Script / Talking Points
        <textarea name="script" defaultValue={tpl?.script} rows={3} className={`mt-1 block w-full ${field}`} />
      </label>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className="btn-ghost px-3 py-1 text-xs disabled:opacity-50">
          {busy ? "Saving…" : tpl ? "Save" : "Add template"}
        </button>
        <button type="button" onClick={onDone} className="btn-ghost px-3 py-1 text-xs">{tpl ? "Cancel" : "Close"}</button>
        {res && <span className={`text-xs ${res.ok ? "text-emerald-700" : "text-red-600"}`}>{res.message}</span>}
      </div>
    </form>
  );
}

function DeleteForm({ id }: { id: string }) {
  const [res, action, busy] = useActionState<TemplateResult | null, FormData>(removeTemplate, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button disabled={busy} className="btn-ghost px-2.5 py-1 text-xs text-red-600 disabled:opacity-50">
        {busy ? "…" : "Delete"}
      </button>
      {res && !res.ok && <span className="ml-2 text-xs text-red-600">{res.message}</span>}
    </form>
  );
}

function TemplateCard({ tpl, editable }: { tpl: AdminTaskTemplate; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="card bg-slate/5">
        <TemplateForm tpl={tpl} onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="font-medium text-ink">{tpl.name}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[tpl.status] ?? "bg-slate/10 text-slate"}`}>
          {tpl.status || "—"}
        </span>
      </div>
      {tpl.whatTheyDo && <p className="text-sm text-slate">{tpl.whatTheyDo}</p>}
      <p className="mt-2 text-xs text-slate/70">
        {[
          tpl.priority && `Priority: ${tpl.priority}`,
          tpl.mode, tpl.geo, tpl.effort, tpl.phase,
          tpl.pass && !tpl.pass.startsWith("N/A") ? `pass: ${tpl.pass}` : null,
        ].filter(Boolean).join(" · ")}
      </p>
      {editable && (
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => setEditing(true)} className="btn-ghost px-2.5 py-1 text-xs">Edit</button>
          <span className="ml-auto"><DeleteForm id={tpl.id} /></span>
        </div>
      )}
    </div>
  );
}

export function TaskTemplateManager({ templates, editable }: { templates: AdminTaskTemplate[]; editable: boolean }) {
  const [creating, setCreating] = useState(false);
  return (
    <div>
      {editable && (
        <div className="mb-4">
          {creating ? (
            <div className="card bg-slate/5">
              <TemplateForm onDone={() => setCreating(false)} />
            </div>
          ) : (
            <button onClick={() => setCreating(true)} className="btn-ghost px-3 py-1.5 text-sm">+ New template</button>
          )}
        </div>
      )}
      {templates.length === 0 ? (
        <div className="card p-8 text-center text-slate">
          No templates yet.{editable ? " Use “New template” to start the library." : ""}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <TemplateCard key={t.id} tpl={t} editable={editable} />
          ))}
        </div>
      )}
    </div>
  );
}
