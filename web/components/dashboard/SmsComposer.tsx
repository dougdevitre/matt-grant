"use client";

import { useMemo, useState, useTransition } from "react";
import { sendTestSms, sendSmsCampaign, type SmsSendState } from "@/app/dashboard/sms/actions";
import { SMS_TEMPLATES, getSmsTemplate, withCompliance, smsSegments } from "@/lib/sms/templates";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-field";

// Audience options + opted-in counts come from the server page (audiences.ts
// pulls from DynamoDB, so it must not be imported into this client bundle).
export type SmsAudienceOption = { value: string; label: string; count: number };

export function SmsComposer({
  groups,
  canSend,
  disabled,
}: {
  groups: SmsAudienceOption[];
  canSend: boolean;
  disabled: boolean;
}) {
  const [key, setKey] = useState(SMS_TEMPLATES[0]?.key ?? "");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>(["subscribers"]);
  const [testTo, setTestTo] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [res, setRes] = useState<SmsSendState | null>(null);
  const [pending, start] = useTransition();

  const tpl = getSmsTemplate(key);
  const body = useMemo(() => withCompliance(tpl?.build(vars) ?? ""), [tpl, vars]);
  const seg = smsSegments(body);
  const reach = selected.reduce((n, v) => n + (groups.find((g) => g.value === v)?.count ?? 0), 0);

  const setVar = (n: string, v: string) => setVars((p) => ({ ...p, [n]: v }));
  const toggle = (v: string) => setSelected((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  const fd = () => {
    const f = new FormData();
    f.set("templateKey", key);
    selected.forEach((g) => f.append("groups", g));
    f.set("scheduledAt", scheduledAt);
    f.set("testTo", testTo);
    tpl?.fields.forEach((fld) => f.set(fld.name, vars[fld.name] ?? ""));
    return f;
  };
  const run = (action: (f: FormData) => Promise<SmsSendState>) => start(async () => setRes(await action(fd())));

  return (
    <div className="card p-6">
      <p className="eyebrow text-brick">Compose a text blast</p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate">Template</label>
          <select
            value={key}
            onChange={(e) => { setKey(e.target.value); setVars({}); setRes(null); }}
            className={`${field} mt-1`}
            aria-label="Template"
          >
            {SMS_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          {tpl && <p className="mt-1 text-xs text-slate">{tpl.description}</p>}
        </div>

        {tpl?.fields.map((f) => (
          <div key={f.name}>
            <label className="text-xs font-semibold text-slate">{f.label}</label>
            <input
              value={vars[f.name] ?? ""}
              onChange={(e) => setVar(f.name, e.target.value)}
              className={`${field} mt-1`}
              placeholder={f.placeholder}
              aria-label={f.label}
            />
          </div>
        ))}

        {/* Live message preview + segment counter (incl. the compliance suffix). */}
        <div>
          <label className="text-xs font-semibold text-slate">Message preview</label>
          <p className="mt-1 whitespace-pre-wrap rounded-sm border border-line bg-paper px-3 py-2 text-sm text-ink">
            {body || <span className="text-slate">Your message will appear here…</span>}
          </p>
          <p className="mt-1 font-mono text-[0.65rem] text-slate">
            {seg.chars} chars · {seg.segments} segment{seg.segments === 1 ? "" : "s"} · {seg.encoding}
            {seg.segments > 1 ? " · multi-segment texts cost more" : ""}
          </p>
        </div>

        {/* Audience — opted-in groups only */}
        <div>
          <label className="text-xs font-semibold text-slate">Send to (opted-in only)</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {groups.map((g) => {
              const on = selected.includes(g.value);
              return (
                <button
                  type="button"
                  key={g.value}
                  onClick={() => toggle(g.value)}
                  className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink"}`}
                >
                  {g.label}
                  <span className={`ml-1.5 font-mono text-[0.6rem] ${on ? "text-paper/60" : "text-slate"}`}>{g.count}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 font-mono text-xs text-slate">~{reach} recipient{reach === 1 ? "" : "s"} (before de-dupe)</p>
        </div>

        {/* Test to a number */}
        <div>
          <label className="text-xs font-semibold text-slate">Send a test to a number</label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className={`${field} max-w-xs`}
              placeholder="+13145551234"
              aria-label="Test recipient phone number"
            />
            <button
              type="button"
              onClick={() => run(sendTestSms)}
              disabled={disabled || pending}
              className="btn-ghost disabled:opacity-50"
            >
              Send test
            </button>
          </div>
          <p className="mt-1 text-xs text-slate">The number must already be opted in (text the keyword first).</p>
        </div>

        {/* Schedule */}
        <div>
          <label className="text-xs font-semibold text-slate">Schedule for later (optional)</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={`${field} mt-1 max-w-xs`}
            aria-label="Schedule send time"
          />
        </div>

        {/* Send to list — admins only, confirm first */}
        {canSend ? (
          <button
            type="button"
            disabled={disabled || pending || !body || selected.length === 0}
            className="btn-primary disabled:opacity-50"
            onClick={() => {
              if (window.confirm(`Send this text to ~${reach} opted-in recipient${reach === 1 ? "" : "s"}?`)) run(sendSmsCampaign);
            }}
          >
            {pending ? "Working…" : scheduledAt ? "Schedule text blast" : "Send to list"}
          </button>
        ) : (
          <p className="text-xs text-slate">Drafting + tests are open to captains; sending to the list is admins only.</p>
        )}

        {res && (
          <p className={`text-sm ${res.ok ? "text-field" : "text-brick"}`}>{res.message}</p>
        )}
        {disabled && (
          <p className="text-xs text-slate">Texting isn&rsquo;t configured yet — add Twilio credentials to enable sending.</p>
        )}
      </div>
    </div>
  );
}
