"use client";

import { useActionState, useState } from "react";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/rbac";
import { BROADCAST_META } from "@/lib/email/broadcasts";
import { SMS_TEMPLATE_META } from "@/lib/sms/templates";
import type { SavedTemplate, TemplateChannel } from "@/lib/notifications/messageTemplates";
import { createTemplate, updateTemplate, removeTemplate, type TemplateResult } from "@/app/dashboard/templates/actions";

// The editable fields per channel come from the existing generic builders a saved template rides:
// email → the "announcement" broadcast; SMS → the "custom" template. (Reused so they can't drift.)
const EMAIL_FIELDS = BROADCAST_META.find((b) => b.key === "announcement")?.fields ?? [];
const SMS_FIELDS = SMS_TEMPLATE_META.find((t) => t.key === "custom")?.fields ?? [];
const fieldsFor = (c: TemplateChannel) => (c === "sms" ? SMS_FIELDS : EMAIL_FIELDS);

const field = "w-full rounded border border-slate/30 px-2 py-1 text-sm";

function TemplateForm({ tpl, channel, onDone }: { tpl?: SavedTemplate; channel: TemplateChannel; onDone: () => void }) {
  const action = tpl ? updateTemplate : createTemplate;
  const [res, formAction, busy] = useActionState<TemplateResult | null, FormData>(action, null);
  const ch = tpl?.channel ?? channel;
  return (
    <form action={formAction} className="grid gap-3 p-4 sm:grid-cols-2">
      {tpl && <input type="hidden" name="id" value={tpl.id} />}
      <input type="hidden" name="channel" value={ch} />
      <label className="text-xs text-slate">
        Template name
        <input name="name" defaultValue={tpl?.name} required className={`mt-1 block w-full ${field}`} placeholder="e.g. Captain weekly brief" />
      </label>
      <label className="text-xs text-slate">
        Default audience role
        <select name="role" defaultValue={tpl?.role ?? ""} className={`mt-1 block w-full ${field}`}>
          <option value="">— none —</option>
          {ROLES.map((r: Role) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </label>
      {fieldsFor(ch).map((f) => {
        const big = (f as { type?: string }).type === "textarea";
        return (
          <label key={f.name} className={`text-xs text-slate ${big ? "sm:col-span-2" : ""}`}>
            {f.label}
            {big ? (
              <textarea name={f.name} defaultValue={tpl?.vars[f.name]} rows={3} className={`mt-1 block w-full ${field}`} placeholder={(f as { placeholder?: string }).placeholder} />
            ) : (
              <input name={f.name} defaultValue={tpl?.vars[f.name]} className={`mt-1 block w-full ${field}`} placeholder={(f as { placeholder?: string }).placeholder} />
            )}
          </label>
        );
      })}
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className="btn-ghost px-3 py-1 text-xs disabled:opacity-50">
          {busy ? "Saving…" : tpl ? "Save" : "Save template"}
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
      <button disabled={busy} className="btn-ghost px-2.5 py-1 text-xs text-red-600 disabled:opacity-50">{busy ? "…" : "Delete"}</button>
      {res && !res.ok && <span className="ml-2 text-xs text-red-600">{res.message}</span>}
    </form>
  );
}

function Card({ tpl }: { tpl: SavedTemplate }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <div className="card bg-slate/5"><TemplateForm tpl={tpl} channel={tpl.channel} onDone={() => setEditing(false)} /></div>;
  const preview = tpl.vars.subject || tpl.vars.headline || tpl.vars.body || "—";
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="font-medium text-ink">{tpl.name}</h3>
        <span className="shrink-0 rounded-full bg-slate/10 px-2 py-0.5 text-xs font-medium text-slate">
          {tpl.channel.toUpperCase()}{tpl.role ? ` · ${ROLE_LABELS[tpl.role]}` : ""}
        </span>
      </div>
      <p className="line-clamp-2 text-sm text-slate">{preview}</p>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => setEditing(true)} className="btn-ghost px-2.5 py-1 text-xs">Edit</button>
        <span className="ml-auto"><DeleteForm id={tpl.id} /></span>
      </div>
    </div>
  );
}

export function TemplateManager({ templates }: { templates: SavedTemplate[] }) {
  const [creating, setCreating] = useState<TemplateChannel | null>(null);
  return (
    <div>
      <div className="mb-4 flex gap-2">
        {creating ? (
          <div className="card w-full bg-slate/5"><TemplateForm channel={creating} onDone={() => setCreating(null)} /></div>
        ) : (
          <>
            <button onClick={() => setCreating("email")} className="btn-ghost px-3 py-1.5 text-sm">+ New email template</button>
            <button onClick={() => setCreating("sms")} className="btn-ghost px-3 py-1.5 text-sm">+ New SMS template</button>
          </>
        )}
      </div>
      {templates.length === 0 ? (
        <div className="card p-8 text-center text-slate">No saved templates yet. Create one to reuse copy + a default role in the composers.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => <Card key={t.id} tpl={t} />)}
        </div>
      )}
    </div>
  );
}
