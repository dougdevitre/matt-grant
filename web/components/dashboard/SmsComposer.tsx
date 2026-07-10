"use client";

import { useMemo, useState, useTransition } from "react";
import { sendTestSms, sendSmsCampaign, type SmsSendState } from "@/app/dashboard/sms/actions";
import { SMS_TEMPLATES, getSmsTemplate, withCompliance, smsSegments, nonGsmChars } from "@/lib/sms/templates";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/rbac";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-field";

// Audience options + opted-in counts come from the server page (audiences.ts
// pulls from DynamoDB, so it must not be imported into this client bundle).
export type SmsAudienceOption = { value: string; label: string; count: number };

export type SavedSmsOption = { id: string; name: string; role: Role | null; vars: Record<string, string> };

export function SmsComposer({
  groups,
  volRoles = [],
  saved = [],
  canSend,
  disabled,
  scope = "admin",
  teamCount = 0,
}: {
  groups: SmsAudienceOption[];
  volRoles?: SmsAudienceOption[];
  saved?: SavedSmsOption[];
  canSend: boolean;
  disabled: boolean;
  // "captain" scopes the whole send to the signed-in captain's own opted-in team:
  // the full-list group + account-role pickers are hidden and the send targets the team
  // (optionally sub-filtered by the volunteer-role chips). "admin" is the full-list composer.
  scope?: "admin" | "captain";
  teamCount?: number;
}) {
  const isCaptain = scope === "captain";
  const [key, setKey] = useState(SMS_TEMPLATES[0]?.key ?? "");
  const [vars, setVars] = useState<Record<string, string>>({});
  // A captain targets their team implicitly (no group chip); an admin defaults to All opted-in.
  const [selected, setSelected] = useState<string[]>(isCaptain ? [] : ["subscribers"]);
  const [roleSel, setRoleSel] = useState<Role[]>([]);
  const [volRoleSel, setVolRoleSel] = useState<string[]>([]);
  const [testTo, setTestTo] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [personalize, setPersonalize] = useState(false);
  const [res, setRes] = useState<SmsSendState | null>(null);
  const [pending, start] = useTransition();

  const tpl = getSmsTemplate(key);
  // With personalization on, the stored body leads with "Hi {first}, " — a merge token the send
  // replaces per recipient. The preview substitutes a sample name so staff see the effect.
  const body = useMemo(() => {
    const built = tpl?.build(vars) ?? "";
    return withCompliance(personalize && built ? `Hi {first}, ${built}` : built);
  }, [tpl, vars, personalize]);
  const preview = body.replace(/\{first\}/g, "Jordan");
  const seg = smsSegments(preview);
  // Group + volunteer-role counts are known up front (both are single roster reads on the
  // server), so fold them into the reach estimate. Clerk account roles stay "counted at send".
  const groupReach = selected.reduce((n, v) => n + (groups.find((g) => g.value === v)?.count ?? 0), 0);
  const volReach = volRoleSel.reduce((n, v) => n + (volRoles.find((o) => o.value === v)?.count ?? 0), 0);
  // Captain scope: whole team by default, or the sum of the selected volunteer-role chips (both
  // already team-scoped counts). Admin scope: groups + volunteer-role selections.
  const reach = isCaptain ? (volRoleSel.length > 0 ? volReach : teamCount) : groupReach + volReach;
  const hasRoles = !isCaptain && roleSel.length > 0; // account-role reach is tallied at send, not counted here

  // Non-GSM characters (smart quotes, dashes, emoji) force pricier UCS-2 — surface them so
  // staff can fix before paying ~2x. Only meaningful when the preview is already UCS-2.
  const offenders = useMemo(() => (seg.encoding === "UCS-2" ? nonGsmChars(preview) : []), [seg.encoding, preview]);

  // Local "now" (YYYY-MM-DDThh:mm) for the datetime-local min + past-time guard.
  const nowLocal = useMemo(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), []);
  const schedInPast = scheduledAt !== "" && scheduledAt < nowLocal;
  const willSchedule = scheduledAt !== "" && !schedInPast;

  const setVar = (n: string, v: string) => setVars((p) => ({ ...p, [n]: v }));
  const toggle = (v: string) => setSelected((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  const toggleRole = (r: Role) => setRoleSel((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  const toggleVolRole = (v: string) => setVolRoleSel((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  // Load a saved SMS template: rides the generic "custom" template — prefill the body + role.
  const loadSaved = (id: string) => {
    const t = saved.find((s) => s.id === id);
    if (!t) return;
    setKey("custom");
    setVars({ ...t.vars });
    setRoleSel(t.role ? [t.role] : []);
    setRes(null);
  };

  const fd = () => {
    const f = new FormData();
    f.set("templateKey", key);
    selected.forEach((g) => f.append("groups", g));
    roleSel.forEach((r) => f.append("roleGroups", r));
    volRoleSel.forEach((v) => f.append("volRoles", v));
    f.set("scheduledAt", scheduledAt);
    f.set("testTo", testTo);
    f.set("personalize", personalize ? "true" : "false");
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
          {saved.length > 0 && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) loadSaved(e.target.value); }}
              className={`${field} mt-2`}
              aria-label="Load a saved template"
            >
              <option value="">Load a saved template…</option>
              {saved.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
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

        {/* Personalize: merge the recipient's first name */}
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={personalize} onChange={(e) => setPersonalize(e.target.checked)} className="h-4 w-4" />
          Personalize with first name
          <span className="text-xs text-slate">— volunteers/team get their name; general opt-ins get “there”.</span>
        </label>

        {/* Live message preview + segment counter (incl. the compliance suffix). */}
        <div>
          <label className="text-xs font-semibold text-slate">Message preview{personalize ? " (sample name shown)" : ""}</label>
          <p className="mt-1 whitespace-pre-wrap rounded-sm border border-line bg-paper px-3 py-2 text-sm text-ink">
            {preview || <span className="text-slate">Your message will appear here…</span>}
          </p>
          <p className="mt-1 font-mono text-[0.65rem] text-slate">
            {seg.chars} chars · {seg.segments} segment{seg.segments === 1 ? "" : "s"} · {seg.encoding}
            {seg.segments > 1 ? " · multi-segment texts cost more" : ""}
            {personalize ? " · counts vary by name length" : ""}
          </p>
          {seg.encoding === "UCS-2" && (
            <p className="mt-1 text-xs text-brick">
              ⚠ A special character{offenders.length ? ` (${offenders.join(" ")})` : ""} is forcing pricier
              {" "}UCS-2 encoding — 70 chars per segment instead of 160. Replace smart quotes, dashes, or emoji with plain text to cut the cost.
            </p>
          )}
        </div>

        {/* Audience — opted-in groups only */}
        <div>
          {isCaptain ? (
            /* Captain scope: the send targets their OWN opted-in team; the full-list group +
               account-role pickers are hidden. Optionally sub-filter by volunteer role below. */
            <div className="rounded-sm border border-field/40 bg-field/10 px-3 py-2 text-sm text-ink">
              <span className="font-semibold">Texting your team only</span>{" "}
              <span className="text-slate">
                — {teamCount} opted-in volunteer{teamCount === 1 ? "" : "s"} on your team
                {volRoles.length > 0 ? ". Narrow it by role below (optional)." : "."}
              </span>
            </div>
          ) : (
            <>
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
              {/* By Clerk account role — opted-in numbers only, resolved at send time. */}
              <label className="mt-3 block text-xs font-semibold text-slate">By account role (opted-in only)</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {ROLES.map((r) => {
                  const on = roleSel.includes(r);
                  return (
                    <button
                      type="button"
                      key={r}
                      onClick={() => toggleRole(r)}
                      className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink"}`}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {/* By volunteer role/door — opted-in numbers only; counts known up front. */}
          {volRoles.length > 0 && (
            <>
              <label className="mt-3 block text-xs font-semibold text-slate">By volunteer role (opted-in only)</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {volRoles.map((o) => {
                  const on = volRoleSel.includes(o.value);
                  return (
                    <button
                      type="button"
                      key={o.value}
                      onClick={() => toggleVolRole(o.value)}
                      className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink"}`}
                    >
                      {o.label}
                      <span className={`ml-1.5 font-mono text-[0.6rem] ${on ? "text-paper/60" : "text-slate"}`}>{o.count}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <p className="mt-2 font-mono text-xs text-slate">
            {reach > 0
              ? `~${reach} recipient${reach === 1 ? "" : "s"} (before de-dupe)`
              : hasRoles
                ? "Opted-in accounts in the selected role(s)"
                : isCaptain
                  ? "No opted-in volunteers on your team yet"
                  : "No audience selected yet"}
            {hasRoles && reach > 0 && <span> + accounts in the selected role(s)</span>}
            {hasRoles && <span> · role counts are tallied at send</span>}
          </p>
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
            min={nowLocal}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={`${field} mt-1 max-w-xs`}
            aria-label="Schedule send time"
          />
          <p className="mt-1 text-xs text-slate">
            Texts only go out 9am–8pm CT — a time outside that waits for the next window.
          </p>
          {schedInPast && (
            <p className="mt-1 text-xs text-brick">That time is in the past — this will send now, not later.</p>
          )}
        </div>

        {/* Send — admins send to the full list; captains send to their own team; confirm first */}
        {canSend ? (
          <button
            type="button"
            // A captain always targets their team (no selection required); an admin must pick an audience.
            disabled={disabled || pending || !body || (!isCaptain && selected.length === 0 && roleSel.length === 0 && volRoleSel.length === 0)}
            className="btn-primary disabled:opacity-50"
            onClick={() => {
              const audience = isCaptain
                ? volRoleSel.length > 0
                  ? `your team in the selected role(s) (~${reach})`
                  : `your team (${teamCount} opted-in)`
                : reach > 0
                  ? `~${reach} opted-in recipient${reach === 1 ? "" : "s"}${hasRoles ? " plus accounts in the selected role(s)" : ""}`
                  : hasRoles
                    ? "all opted-in accounts in the selected role(s)"
                    : "the selected audience";
              const when = willSchedule ? ` — scheduled for ${scheduledAt.replace("T", " ")}` : "";
              if (window.confirm(`Send this text to ${audience}${when}?`)) run(sendSmsCampaign);
            }}
          >
            {pending ? "Working…" : willSchedule ? "Schedule text blast" : isCaptain ? "Send to my team" : "Send to list"}
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
