"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { sendTestSms, sendSmsCampaign, type SmsSendState } from "@/app/dashboard/sms/actions";
import { SMS_TEMPLATES, getSmsTemplate, withCompliance, smsSegments, nonGsmChars } from "@/lib/sms/templates";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/rbac";
// Pure cost model — the SAME math the Spend Decider page uses (lib/reports/ lives
// OUTSIDE lib/sms/, so importing it here adds no lib/sms → lib/voters edge and
// keeps the TCPA isolation guard green). No data store, no send — client-safe.
import { spendModel, coverageRows, UNSCORED_KEY, SMS_PRICING_DEFAULTS } from "@/lib/reports/smsSpend";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-field";

// Audience options + opted-in counts come from the server page (audiences.ts
// pulls from DynamoDB, so it must not be imported into this client bundle).
export type SmsAudienceOption = { value: string; label: string; count: number };

// A priority-tier preset ("Who to reach — by likelihood to vote"). `tokens` are the
// pre-expanded target tokens (segment:<NAME> [+ outstanding]) the server built from
// SMS_PRIORITY_PRESETS, so the client needs no audiences.ts import; `count` is the
// opted-in reach of the group (segment-count sum, or the whole list for "all").
export type SmsPriorityPresetOption = { value: string; label: string; tokens: string[]; count: number };

export type SavedSmsOption = { id: string; name: string; role: Role | null; vars: Record<string, string> };

export function SmsComposer({
  groups,
  volRoles = [],
  targets = [],
  priorityPresets = [],
  saved = [],
  canSend,
  disabled,
  scope = "admin",
  teamCount = 0,
  optedIn = 0,
  segmentCounts = {},
}: {
  groups: SmsAudienceOption[];
  volRoles?: SmsAudienceOption[];
  // Targeting filter chips (county / not-yet-voted) with opted-in counts — they
  // NARROW the selected audience by consent-row geo fields. Admin composer only;
  // empty hides the section. (Voter segments live in the priority-tier dropdown.)
  targets?: SmsAudienceOption[];
  // Priority-tier presets for the "Who to reach — by likelihood to vote" dropdown.
  // Admin composer only; empty hides the selector. Always passed for admins so the
  // disabled/zero empty state can render before enrichment tags exist.
  priorityPresets?: SmsPriorityPresetOption[];
  saved?: SavedSmsOption[];
  canSend: boolean;
  disabled: boolean;
  // "captain" scopes the whole send to the signed-in captain's own opted-in team:
  // the full-list group + account-role pickers are hidden and the send targets the team
  // (optionally sub-filtered by the volunteer-role chips). "admin" is the full-list composer.
  scope?: "admin" | "captain";
  teamCount?: number;
  // Opted-in list size + per-segment opted-in counts (Segment name + UNSCORED), for the
  // inline budget field's cap + priority-coverage readout. Admin composer only.
  optedIn?: number;
  segmentCounts?: Record<string, number>;
}) {
  const isCaptain = scope === "captain";
  const [key, setKey] = useState(SMS_TEMPLATES[0]?.key ?? "");
  const [vars, setVars] = useState<Record<string, string>>({});
  // A captain targets their team implicitly (no group chip); an admin defaults to All opted-in.
  const [selected, setSelected] = useState<string[]>(isCaptain ? [] : ["subscribers"]);
  const [roleSel, setRoleSel] = useState<Role[]>([]);
  const [volRoleSel, setVolRoleSel] = useState<string[]>([]);
  const [targetSel, setTargetSel] = useState<string[]>([]);
  const [presetVal, setPresetVal] = useState("all"); // priority-tier preset value; "all" = no segment filter
  const [zipFilter, setZipFilter] = useState(""); // free-form ZIP list → zip:<zip5> tokens
  const [budget, setBudget] = useState(""); // optional $ budget → auto-computed Max texts cap
  const [maxTexts, setMaxTexts] = useState(""); // optional cap — trims the lowest-priority tail
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
  const toggleTarget = (v: string) => setTargetSel((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  const zipTokens = useMemo(
    () => zipFilter.split(/[\s,]+/).filter((z) => /^\d{5}$/.test(z)).map((z) => `zip:${z}`),
    [zipFilter],
  );
  // Priority-tier preset: its pre-expanded segment (+ outstanding) tokens narrow the send
  // to the chosen likelihood group. "all" carries no tokens (whole opted-in list, ranked).
  const selectedPreset = useMemo(() => priorityPresets.find((p) => p.value === presetVal), [priorityPresets, presetVal]);
  const presetTokenList = useMemo(() => selectedPreset?.tokens ?? [], [selectedPreset]);
  const filtering = presetTokenList.length > 0 || targetSel.length > 0 || zipTokens.length > 0;
  // Whether any voter-score tags exist yet (UNSCORED excluded). Drives the disabled
  // empty state on the preset dropdown + budget coverage, so the feature is visible
  // before `npm run enrich:sms` has tagged anyone.
  const haveScores = useMemo(
    () => Object.entries(segmentCounts).some(([k, n]) => k !== UNSCORED_KEY && (n ?? 0) > 0),
    [segmentCounts],
  );
  // The priority group the budget/coverage math is about: the selected preset's reach,
  // or the whole opted-in list for "all". Falls back to optedIn when presets are absent.
  const groupSize = selectedPreset ? selectedPreset.count : optedIn;

  // Inline budget → cap. Reuses the Spend Decider's pure model (one blast, sends = 1):
  // cost per text from the live message's segment count + shared Twilio planning rates.
  // capPerBlast is null when the budget already covers the whole group (no cap needed).
  const budgetCents = Math.round((parseFloat(budget) || 0) * 100);
  const spend = useMemo(
    () =>
      spendModel({
        segments: seg.segments,
        basePerSegCents: SMS_PRICING_DEFAULTS.basePerSegCents,
        carrierPerSegCents: SMS_PRICING_DEFAULTS.carrierPerSegCents,
        replyRatePct: SMS_PRICING_DEFAULTS.replyRatePct,
        listSize: groupSize,
        sends: 1,
        budgetCents,
      }),
    [seg.segments, groupSize, budgetCents],
  );
  const budgetActive = budgetCents > 0 && seg.segments > 0;
  const budgetCap = budgetActive ? spend.capPerBlast : null; // null = budget covers everyone
  // Where a budgeted blast lands: cumulate the selected group's per-segment counts in
  // priority order and name the last group the cap reaches. "all" spans every segment
  // (+ unscored tail); a restricted preset only counts its own segments.
  const coverage = useMemo(() => {
    if (!budgetActive || budgetCap == null) return null;
    const inGroup = new Set(
      presetTokenList
        .filter((t) => t.startsWith("segment:"))
        .map((t) => t.slice("segment:".length)),
    );
    const counts: Record<string, number> =
      inGroup.size === 0
        ? segmentCounts // "all": whole ledger incl. UNSCORED
        : Object.fromEntries(Object.entries(segmentCounts).filter(([k]) => inGroup.has(k)));
    const rows = coverageRows(counts, spend.perTextCents, budgetCap);
    const reached = rows.filter((r) => r.count > 0 && r.status !== "beyond");
    const last = reached[reached.length - 1];
    return { lastGroup: last ? (last.key === UNSCORED_KEY ? "unscored" : last.key) : null };
  }, [budgetActive, budgetCap, presetTokenList, segmentCounts, spend.perTextCents]);
  // Effective send cap: an explicit budget wins; otherwise the manual Max texts field.
  const rawMax = parseInt(maxTexts, 10);
  const manualCap = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : null;
  const effectiveCap = budgetActive ? budgetCap : manualCap;
  const usd = (cents: number, digits = 2) =>
    "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

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
    // Priority-preset tokens (segment:/outstanding) + any county/ZIP narrowing chips.
    [...presetTokenList, ...targetSel, ...zipTokens].forEach((t) => f.append("targets", t));
    // A budget-derived cap wins over the manual Max texts field when a budget is set.
    f.set("maxTexts", effectiveCap != null ? String(effectiveCap) : "");
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
              {/* Priority-tier preset: narrow the opted-in audience to a voter-priority
                  group, ordered by likelihood to vote. Sends still reach only opted-in
                  numbers — this filters + ranks them; it never reaches the voter file. */}
              {priorityPresets.length > 0 && (
                <>
                  <label className="mt-3 block text-xs font-semibold text-slate" htmlFor="sms-priority">
                    Who to reach — by likelihood to vote
                  </label>
                  <select
                    id="sms-priority"
                    value={presetVal}
                    onChange={(e) => setPresetVal(e.target.value)}
                    disabled={!haveScores}
                    className={`${field} mt-1 disabled:opacity-60`}
                    aria-label="Voter priority group"
                  >
                    {priorityPresets.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                        {p.value !== "all" ? ` · ${p.count}` : ""}
                      </option>
                    ))}
                  </select>
                  {haveScores ? (
                    <p className="mt-1 text-xs text-slate">
                      Narrows the opted-in audience to this voter-priority group and queues the highest-likelihood voters first.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gold-ink">
                      No voter-score tags yet — run <code>npm run enrich:sms</code> to tag opted-in voters by likelihood, then reload. Until then, blasts go to all opted-in numbers.
                    </p>
                  )}
                </>
              )}
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
          {/* Targeting filters — narrow the selected audience by consent-row fields
              (self-reported county/ZIP from the vote agent + the enrichment job's
              voter tags). Chip counts are the most each filter can reach. */}
          {!isCaptain && targets.length > 0 && (
            <>
              <label className="mt-3 block text-xs font-semibold text-slate">Narrow by county / voter tag (optional)</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {targets.map((o) => {
                  const on = targetSel.includes(o.value);
                  return (
                    <button
                      type="button"
                      key={o.value}
                      onClick={() => toggleTarget(o.value)}
                      className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink"}`}
                    >
                      {o.label}
                      <span className={`ml-1.5 font-mono text-[0.6rem] ${on ? "text-paper/60" : "text-slate"}`}>{o.count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={zipFilter}
                  onChange={(e) => setZipFilter(e.target.value)}
                  className={`${field} max-w-xs`}
                  placeholder="ZIPs, e.g. 63011, 63017"
                  aria-label="Narrow by ZIP codes"
                />
                {zipTokens.length > 0 && (
                  <span className="font-mono text-[0.65rem] text-slate">{zipTokens.length} ZIP{zipTokens.length === 1 ? "" : "s"}</span>
                )}
              </div>
              {filtering && (
                <p className="mt-1 text-xs text-slate">
                  Filters narrow the audience above — only opted-in numbers with matching county/ZIP/tag data are texted.
                </p>
              )}
            </>
          )}
          {/* Budget → cap: enter a dollar budget and the composer computes the Max texts
              cap live (same math as the Spend Decider), so operators don't page-hop.
              A budget wins over the manual cap below and always cuts the lowest-priority tail. */}
          {!isCaptain && (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-slate" htmlFor="sms-budget">Budget $ (optional)</label>
                <input
                  id="sms-budget"
                  type="number"
                  min={0}
                  step="5"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className={`${field} max-w-[8rem]`}
                  placeholder="no budget"
                  aria-label="Budget in dollars for this blast"
                />
                <Link href="/dashboard/sms/spend" className="font-mono text-xs text-field hover:underline">
                  Full spend planner →
                </Link>
              </div>
              {budgetActive && (
                <p className="mt-1 text-xs text-slate">
                  {budgetCap == null
                    ? `${usd(budgetCents)} covers all ~${groupSize.toLocaleString()} in this group (${usd(spend.perTextCents, 4)}/text) — no cap needed.`
                    : `${usd(budgetCents)} funds ~${budgetCap.toLocaleString()} texts (${usd(spend.perTextCents, 4)}/text) — the top ${Math.round(spend.coveragePct)}% of ${groupSize.toLocaleString()} by voter priority${coverage?.lastGroup ? `, reaching down through ${coverage.lastGroup}` : ""}. Fills Max texts automatically; nobody below the line is removed.`}
                </p>
              )}
            </div>
          )}
          {/* Priority cap: the queue always sends highest-likelihood voters first; an
              optional cap trims the lowest-priority tail (reported after the send). */}
          {!isCaptain && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate" htmlFor="sms-max-texts">Max texts (optional)</label>
              <input
                id="sms-max-texts"
                type="number"
                min={1}
                value={budgetActive ? (budgetCap ?? "") : maxTexts}
                onChange={(e) => setMaxTexts(e.target.value)}
                disabled={budgetActive}
                className={`${field} max-w-[8rem] disabled:opacity-60`}
                placeholder="no cap"
                aria-label="Maximum number of texts to send"
              />
              <span className="text-xs text-slate">
                {budgetActive
                  ? "Set from your budget above — clear the budget to enter a cap manually."
                  : "Sends queue highest-likelihood voters first (segment + turnout score); a cap cuts only the lowest-priority tail. Unscored numbers go last but are never dropped without a cap."}
              </span>
            </div>
          )}
          <p className="mt-2 font-mono text-xs text-slate">
            {reach > 0
              ? `~${reach} recipient${reach === 1 ? "" : "s"} (before de-dupe${filtering ? " and filters" : ""})`
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
