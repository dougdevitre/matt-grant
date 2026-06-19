"use client";

import { useState, useTransition } from "react";
import { sendTestCampaign, sendCampaign, type SendState, type Audience } from "@/app/dashboard/emails/actions";
import type { BroadcastMeta } from "@/lib/email/broadcasts";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink";
const topicLabel: Record<string, string> = {
  news: "News", issues: "Issues", gotv: "GOTV", fundraising: "Fundraising", events: "Events",
};

export function EmailComposer({
  broadcasts,
  counts,
  canSend,
  disabled,
}: {
  broadcasts: BroadcastMeta[];
  counts: { volunteers: number; donors: number };
  canSend: boolean;
  disabled: boolean;
}) {
  const [key, setKey] = useState(broadcasts[0]?.key ?? "");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [audience, setAudience] = useState<Audience>("all");
  const [scheduledAt, setScheduledAt] = useState("");
  const [res, setRes] = useState<SendState | null>(null);
  const [pending, start] = useTransition();

  const tpl = broadcasts.find((b) => b.key === key);
  const audienceCount = audience === "volunteers" ? counts.volunteers : audience === "donors" ? counts.donors : counts.volunteers + counts.donors;
  const setVar = (n: string, v: string) => setVars((p) => ({ ...p, [n]: v }));

  const fd = () => {
    const f = new FormData();
    f.set("templateKey", key);
    f.set("audience", audience);
    f.set("scheduledAt", scheduledAt);
    tpl?.fields.forEach((field) => f.set(field.name, vars[field.name] ?? ""));
    return f;
  };
  const run = (action: (f: FormData) => Promise<SendState>) => start(async () => setRes(await action(fd())));

  return (
    <div className="card p-6">
      <p className="eyebrow text-brick">Compose a broadcast</p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate">Template</label>
          <select
            value={key}
            onChange={(e) => { setKey(e.target.value); setVars({}); setRes(null); }}
            className={`${field} mt-1`}
            aria-label="Template"
          >
            {broadcasts.map((b) => (
              <option key={b.key} value={b.key}>{b.label}</option>
            ))}
          </select>
          {tpl && (
            <p className="mt-1 text-xs text-slate">
              {tpl.description} · sends to the{" "}
              <span className="rounded-sm bg-field/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-field">{topicLabel[tpl.topic] ?? tpl.topic}</span>{" "}
              topic (skips anyone opted out of it).
            </p>
          )}
        </div>

        {tpl?.fields.map((f) => (
          <div key={f.name}>
            <label className="text-xs font-semibold text-slate">{f.label}{f.required ? " *" : ""}</label>
            {f.type === "textarea" ? (
              <textarea rows={4} value={vars[f.name] ?? ""} onChange={(e) => setVar(f.name, e.target.value)} className={`${field} mt-1 resize-y`} placeholder={f.placeholder} aria-label={f.label} />
            ) : f.type === "select" ? (
              <select value={vars[f.name] ?? ""} onChange={(e) => setVar(f.name, e.target.value)} className={`${field} mt-1`} aria-label={f.label}>
                <option value="">Choose…</option>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input type={f.type === "number" ? "number" : "text"} value={vars[f.name] ?? ""} onChange={(e) => setVar(f.name, e.target.value)} className={`${field} mt-1`} placeholder={f.placeholder} aria-label={f.label} />
            )}
          </div>
        ))}
        {tpl && tpl.fields.length === 0 && <p className="text-sm text-slate">This template has no inputs — ready to send.</p>}

        <div className="flex flex-wrap items-center gap-3">
          <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className={`${field} w-auto`} aria-label="Audience">
            <option value="all">Everyone</option>
            <option value="volunteers">Volunteers</option>
            <option value="donors">Donors</option>
          </select>
          <span className="font-mono text-xs text-slate">~{audienceCount} recipient{audienceCount === 1 ? "" : "s"} (before opt-outs)</span>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate">Schedule for later (optional)</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={`${field} mt-1 w-auto`}
            aria-label="Schedule send time"
          />
          {scheduledAt && <p className="mt-1 text-xs text-slate">Sends automatically at the time above (the background worker picks it up).</p>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" disabled={pending || disabled} onClick={() => run(sendTestCampaign)} className="btn-ghost disabled:opacity-50">
          {pending ? "Working…" : "Send test to me"}
        </button>
        {canSend && (
          <button
            type="button"
            disabled={pending || disabled}
            onClick={() => {
              const msg = scheduledAt
                ? `Schedule "${tpl?.label}" for ${scheduledAt.replace("T", " ")} to ~${audienceCount} recipients?`
                : `Send "${tpl?.label}" to ~${audienceCount} recipients? This cannot be undone.`;
              if (confirm(msg)) run(sendCampaign);
            }}
            className="btn-primary disabled:opacity-50"
          >
            {pending ? "Working…" : scheduledAt ? "Schedule send" : "Send to list"}
          </button>
        )}
      </div>

      {res && (
        <p className={`mt-3 rounded-sm border px-3 py-2 text-sm ${res.ok ? "border-field/40 bg-field/10 text-field" : "border-brick/40 bg-brick/10 text-brick"}`}>{res.message}</p>
      )}
      {!canSend && <p className="mt-3 text-xs text-slate">You can draft and send tests. Sending to the list is limited to admins.</p>}
    </div>
  );
}
