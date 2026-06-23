"use client";

import { useEffect, useState, useTransition } from "react";
import { sendTestCampaign, sendCampaign, type SendState, type Audience } from "@/app/dashboard/emails/actions";
import type { BroadcastMeta } from "@/lib/email/broadcasts";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink";
const topicLabel: Record<string, string> = {
  news: "News", issues: "Issues", gotv: "GOTV", fundraising: "Fundraising", events: "Events",
};

export type ContactCounts = Record<ContactGroup, number>;

export function EmailComposer({
  broadcasts,
  counts,
  segments = [],
  canSend,
  disabled,
}: {
  broadcasts: BroadcastMeta[];
  counts: ContactCounts;
  segments?: { value: string; label: string; count: number; group: string }[];
  canSend: boolean;
  disabled: boolean;
}) {
  const [key, setKey] = useState(broadcasts[0]?.key ?? "");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<ContactGroup[]>(["volunteers", "donors"]);
  const [segment, setSegment] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [res, setRes] = useState<SendState | null>(null);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Live preview: render the selected template with the entered variables, the
  // way a recipient would see it. Debounced so each keystroke doesn't refetch,
  // and aborted on change so a slow response can't overwrite a newer one.
  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const r = await fetch("/api/email/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ templateKey: key, vars }),
          signal: ctrl.signal,
        });
        if (r.ok) setPreview(await r.json());
      } catch {
        /* aborted or offline — keep the last good preview */
      } finally {
        if (!ctrl.signal.aborted) setPreviewLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [key, vars]);

  const tpl = broadcasts.find((b) => b.key === key);
  const toggle = (g: ContactGroup) => setGroups((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  const allSelected = CONTACT_GROUPS.every((g) => groups.includes(g));
  const selectAll = () => setGroups(allSelected ? [] : [...CONTACT_GROUPS]);

  // Approximate combined reach (real send de-dupes overlap + applies opt-outs).
  const approxCount = useMemo(() => {
    const fromGroups = groups.reduce((n, g) => n + (counts[g] ?? 0), 0);
    const fromSeg = segment ? (segments.find((s) => s.value === segment)?.count ?? 0) : 0;
    return fromGroups + fromSeg;
  }, [groups, segment, counts, segments]);

  // A send is "internal" (bypasses topic opt-outs) only when every selected group
  // is a team group and no external supporter segment is chosen.
  const isInternal = groups.length > 0 && groups.every((g) => TEAM_GROUPS.has(g)) && !segment;

  const setVar = (n: string, v: string) => setVars((p) => ({ ...p, [n]: v }));

  const fd = () => {
    const f = new FormData();
    f.set("templateKey", key);
    groups.forEach((g) => f.append("groups", g));
    if (segment) f.set("segment", segment);
    f.set("scheduledAt", scheduledAt);
    tpl?.fields.forEach((fld) => f.set(fld.name, vars[fld.name] ?? ""));
    return f;
  };
  const run = (action: (f: FormData) => Promise<SendState>) => start(async () => setRes(await action(fd())));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
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
            {f.rich && (
              <p className="mt-1 text-[0.7rem] text-slate">
                Formatting: <code className="font-mono">**bold**</code>, <code className="font-mono">*italic*</code>,{" "}
                <code className="font-mono">[link](https://…)</code>, blank line = new paragraph, <code className="font-mono">-</code> = bullet. See the live preview.
              </p>
            )}
          </div>
        ))}
        {tpl && tpl.fields.length === 0 && <p className="text-sm text-slate">This template has no inputs — ready to send.</p>}

        {/* Audience — any or all contact groups */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate">Send to</label>
            <button type="button" onClick={selectAll} className="font-mono text-[0.65rem] uppercase tracking-eyebrow text-field hover:underline">
              {allSelected ? "Clear all" : "Select all contacts"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {CONTACT_GROUPS.map((g) => {
              const on = groups.includes(g);
              return (
                <button
                  type="button"
                  key={g}
                  onClick={() => toggle(g)}
                  className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink"}`}
                >
                  {GROUP_LABELS[g]}
                  <span className={`ml-1.5 font-mono text-[0.6rem] ${on ? "text-paper/60" : "text-slate"}`}>{counts[g] ?? 0}</span>
                </button>
              );
            })}
          </div>

          {segments.length > 0 && (
            <div className="mt-2">
              <select value={segment} onChange={(e) => setSegment(e.target.value)} className={`${field} w-auto`} aria-label="Advanced supporter segment">
                <option value="">Advanced: also target supporters…</option>
                {[...new Set(segments.map((s) => s.group))].map((group) => (
                  <optgroup key={group} label={group}>
                    {segments.filter((s) => s.group === group).map((s) => (
                      <option key={s.value} value={s.value}>{s.label} ({s.count})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          <p className="mt-2 font-mono text-xs text-slate">
            ~{approxCount} recipient{approxCount === 1 ? "" : "s"} (before de-dupe &amp; opt-outs)
            {isInternal && <span className="ml-1 text-field">· team send — bypasses topic opt-outs</span>}
          </p>
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
              const who = groups.map((g) => GROUP_LABELS[g]).join(" + ") || (segment ? "the selected segment" : "no one");
              const msg = scheduledAt
                ? `Schedule "${tpl?.label}" for ${scheduledAt.replace("T", " ")} to ~${approxCount} recipients (${who})?`
                : `Send "${tpl?.label}" to ~${approxCount} recipients (${who})? This cannot be undone.`;
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

      <div className="card overflow-hidden p-0 lg:sticky lg:top-6">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="min-w-0">
            <p className="eyebrow text-slate">Live preview</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink" title={preview?.subject}>
              {preview?.subject || "—"}
            </p>
          </div>
          {previewLoading && <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">Rendering…</span>}
        </div>
        {preview ? (
          <iframe
            title="Email preview"
            srcDoc={preview.html}
            className="h-[560px] w-full border-0 bg-white"
            sandbox=""
          />
        ) : (
          <div className="flex h-[560px] items-center justify-center px-6 text-center text-sm text-slate">
            Pick a template to see a live preview here.
          </div>
        )}
        <p className="border-t border-line px-5 py-2 text-[0.7rem] text-slate">
          Sample preview — personalization and the unsubscribe link are filled per recipient at send time.
        </p>
      </div>
    </div>
  );
}
