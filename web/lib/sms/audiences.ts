import { getVolunteers } from "@/lib/queries";
import { listConsent, optedInSet, type SmsConsentRow } from "@/lib/sms/consent";
import { listBlocked } from "@/lib/sms/moderation";
import { toE164 } from "@/lib/sms/send";
import { listClerkContactsByRole } from "@/lib/clerkAudiences";
import { ROLE_LABELS, type Role } from "@/lib/rbac";
import { VOLUNTEER_ROLES, JOIN_DOORS, isVolunteerRole, isJoinDoor } from "@/lib/volunteer/taxonomy";
import { COUNTIES, countyByKey } from "@/lib/sms/geo";
import { SCHOOL_DISTRICTS, districtById } from "@/lib/sms/school-districts";

// Resolve SMS broadcast recipients. Unlike email, the audience is gated on
// recorded opt-in: every candidate number is intersected with optedInSet(), so
// the result is opted-in BY CONSTRUCTION (the drain re-checks at send too, in
// case someone texts STOP between queueing and sending). Volunteers are the only
// NAMED contact store with numbers. Donors have no named source here, but a donor
// who checks the WinRed SMS-consent box enters the shared opt-in ledger (consent
// source "winred") and is therefore reachable via the "subscribers" (All opted-in)
// group — intended: that checkbox is a broad campaign-SMS opt-in, so they're a
// first-class opted-in subscriber, same as a keyword/web opt-in.
export const SMS_GROUPS = ["subscribers", "volunteers"] as const;
export type SmsGroup = (typeof SMS_GROUPS)[number];

export const SMS_GROUP_LABELS: Record<SmsGroup, string> = {
  subscribers: "All opted-in",
  volunteers: "Volunteers",
};

export function isSmsGroup(v: string): v is SmsGroup {
  return (SMS_GROUPS as readonly string[]).includes(v);
}

// ── Volunteer-role targeting ──────────────────────────────────────────────────
// A third audience dimension (parallel to Clerk account roles): segment the
// volunteer roster by the campaign's own taxonomy — Role Interests (Canvasser,
// Phone Banker, Poll Watcher, …) and the /join Door they came through. The phone
// and these tags live on the SAME volunteer row, so this is a read-time filter,
// still intersected with the opt-in ledger. Tokens are namespaced ("role:<name>"
// / "door:<name>") so both axes share one selection dimension unambiguously.
export type VolRoleOption = { value: string; label: string };
export const VOL_ROLE_OPTIONS: VolRoleOption[] = [
  ...VOLUNTEER_ROLES.map((r) => ({ value: `role:${r.name}`, label: r.name })),
  ...JOIN_DOORS.map((d) => ({ value: `door:${d}`, label: `Door: ${d}` })),
];

type VolRoleToken = { kind: "role" | "door"; value: string };

/** Parse+validate a "role:<name>" / "door:<name>" token against the taxonomy, or null. */
export function parseVolRole(token: string): VolRoleToken | null {
  const i = token.indexOf(":");
  if (i < 0) return null;
  const kind = token.slice(0, i);
  const value = token.slice(i + 1);
  if (kind === "role" && isVolunteerRole(value)) return { kind: "role", value };
  if (kind === "door" && isJoinDoor(value)) return { kind: "door", value };
  return null;
}

function volMatches(v: { roles: string[]; door: string | null }, tokens: VolRoleToken[]): boolean {
  return tokens.some((t) => (t.kind === "role" ? v.roles?.includes(t.value) : v.door === t.value));
}

// ── Targeting filters (consent-row fields only) ───────────────────────────────
// A fourth dimension that NARROWS whatever the groups/roles selected, matching on
// plain fields carried by the consent row itself: self-reported geography from
// the SMS vote agent, and the denormalized voter tags the out-of-band enrichment
// job wrote (scripts/enrich-sms-audience.ts). Nothing here reads voter data —
// that's the point of the denormalization (candidate/sms-targeting-plan.md §2).
// Tokens: "county:<key>" (lib/sms/geo.ts), "zip:<zip5>", "segment:<name>", and
// "outstanding" (skip numbers confirmed already voted — GOTV chase mode).
// Semantics: OR within a kind, AND across kinds. A row with no data for a
// filtered kind is dropped — a geo-targeted send reaches only known geography.

// Label mirror of the voter-score segment names. Deliberately NOT imported from
// lib/voters/score (the isolation guard forbids lib/sms → lib/voters imports);
// these are just the strings the enrichment job denormalizes onto consent rows.
export const VOTER_SEGMENT_NAMES = ["MOBILIZE", "BANK", "PERSUADE", "PROSPECT", "MONITOR"] as const;

export const OUTSTANDING_TOKEN = "outstanding";

export type TargetOption = { value: string; label: string };
export const TARGET_COUNTY_OPTIONS: TargetOption[] = Object.values(COUNTIES).map((c) => ({
  value: `county:${c.key}`,
  label: c.name,
}));
export const TARGET_SEGMENT_OPTIONS: TargetOption[] = VOTER_SEGMENT_NAMES.map((s) => ({
  value: `segment:${s}`,
  label: s,
}));
// District chips exist only once the sourced crosswalk is generated
// (school-districts.data.ts) — SCHOOL_DISTRICTS is empty until then.
export const TARGET_DISTRICT_OPTIONS: TargetOption[] = Object.values(SCHOOL_DISTRICTS).map((d) => ({
  value: `district:${d.id}`,
  label: d.name,
}));

export type TargetToken = { kind: "county" | "zip" | "segment" | "district"; value: string } | { kind: "outstanding" };

/** Parse+validate a targeting token, or null (invalid tokens are ignored, never widen). */
export function parseTargetToken(token: string): TargetToken | null {
  if (token === OUTSTANDING_TOKEN) return { kind: "outstanding" };
  const i = token.indexOf(":");
  if (i < 0) return null;
  const kind = token.slice(0, i);
  const value = token.slice(i + 1);
  if (kind === "county" && countyByKey(value)) return { kind: "county", value };
  if (kind === "zip" && /^\d{5}$/.test(value)) return { kind: "zip", value };
  if (kind === "segment" && (VOTER_SEGMENT_NAMES as readonly string[]).includes(value)) return { kind: "segment", value };
  if (kind === "district" && districtById(value)) return { kind: "district", value };
  return null;
}

function rowMatchesTargets(row: SmsConsentRow | undefined, tokens: TargetToken[]): boolean {
  const counties = tokens.filter((t) => t.kind === "county").map((t) => (t as { value: string }).value);
  const zips = tokens.filter((t) => t.kind === "zip").map((t) => (t as { value: string }).value);
  const segments = tokens.filter((t) => t.kind === "segment").map((t) => (t as { value: string }).value);
  const districts = tokens.filter((t) => t.kind === "district").map((t) => (t as { value: string }).value);
  const outstanding = tokens.some((t) => t.kind === "outstanding");
  if (counties.length && !(row?.county && counties.includes(row.county))) return false;
  if (zips.length && !(row?.zip && zips.includes(row.zip))) return false;
  if (segments.length && !(row?.voterSegment && segments.includes(row.voterSegment))) return false;
  if (districts.length && !(row?.schoolDistrict && districts.includes(row.schoolDistrict))) return false;
  // "outstanding" drops only CONFIRMED-banked rows; unenriched rows stay in —
  // never silently exclude someone just because we don't know their status.
  if (outstanding && row?.banked === true) return false;
  return true;
}

export function smsAudienceLabel(groups: SmsGroup[], roles: Role[] = [], volRoles: string[] = [], targets: string[] = []): string {
  const parts = groups.map((g) => SMS_GROUP_LABELS[g]);
  for (const r of roles) parts.push(`Role: ${ROLE_LABELS[r]}`);
  for (const t of volRoles) {
    const opt = VOL_ROLE_OPTIONS.find((o) => o.value === t);
    if (opt) parts.push(opt.label);
  }
  const filters: string[] = [];
  for (const t of targets) {
    const p = parseTargetToken(t);
    if (!p) continue;
    if (p.kind === "county") filters.push(countyByKey(p.value)?.name ?? p.value);
    else if (p.kind === "zip") filters.push(`ZIP ${p.value}`);
    else if (p.kind === "segment") filters.push(p.value);
    else if (p.kind === "district") filters.push(districtById(p.value)?.name ?? p.value);
    else filters.push("not yet voted");
  }
  const base = parts.join(" + ");
  if (filters.length) return base ? `${base} · ${filters.join(", ")}` : filters.join(", ");
  return base || "—";
}

// A resolved SMS recipient: the opted-in number plus their first name when a source
// carries one (volunteer roster / Clerk contact) — so the drain can merge "{first}".
// The raw subscribers ledger has no name (first stays undefined → "there" at merge).
export type SmsRecipient = { phone: string; first?: string };

const firstOf = (name?: string | null): string | undefined => {
  const f = (name ?? "").trim().split(/\s+/)[0];
  return f || undefined;
};

const lc = (s?: string | null): string => (s ?? "").trim().toLowerCase();

// Scope a send to a single caller. When `captainEmail` is set (a captain-scoped
// send, see rbac `sendTeamSms`), the resolver reaches ONLY that captain's own
// opted-in team — the full opt-in ledger and Clerk account-role cohorts are
// dropped server-side, so the scope can't be widened by a tampered form.
// `targets` (county/zip/segment/outstanding tokens) NARROW the resolved set by
// consent-row fields; invalid tokens are ignored, so a tampered token can only
// ever shrink the audience, never widen it.
export type SmsResolveOpts = { captainEmail?: string; targets?: string[] };

// Recipients from the chosen groups + Clerk roles + volunteer-role segments, filtered
// to opted-in, minus blocked numbers, and de-duplicated. Every source is gated on opt-in
// BY CONSTRUCTION — a candidate is only texted if its number is in the consent ledger. As
// defense-in-depth, a volunteer whose roster opt-out flag is set is dropped even if a stale
// opted_in row lingers (a STOP mirrors to the roster). (The drain re-checks opt-in + block
// at send.) Deduped by phone in a Map so a NAMED source (volunteer/role) upgrades a nameless
// subscriber entry for the same number.
export async function resolveSmsRecipients(
  groups: SmsGroup[],
  roles: Role[] = [],
  volRoles: string[] = [],
  opts: SmsResolveOpts = {},
): Promise<SmsRecipient[]> {
  const captainScope = lc(opts.captainEmail); // "" when unscoped (admin/full-list send)
  // One ledger read serves both the opt-in gate and the targeting filter.
  const [consentRows, blocked] = await Promise.all([listConsent(), listBlocked()]);
  const opted = new Set(consentRows.filter((r) => r.status === "opted_in").map((r) => r.phone));
  const rowByPhone = new Map(consentRows.map((r) => [r.phone, r]));
  const blockedSet = new Set(blocked.map((b) => b.phone));
  const byPhone = new Map<string, string | undefined>();
  const add = (e: string, first?: string) => {
    if (blockedSet.has(e)) return;
    byPhone.set(e, first ?? byPhone.get(e)); // keep an existing name; add one if the source has it
  };
  // A captain-scoped send never reaches the full opt-in ledger — only their own team below.
  if (!captainScope && groups.includes("subscribers")) for (const p of opted) add(p);

  // One roster read serves the "volunteers" group, any volunteer-role segments, AND the
  // captain-team scope. Under a captain scope, "my whole team" is the default (no group chip),
  // while volunteer-role tokens still sub-filter within that team.
  const tokens = volRoles.map(parseVolRole).filter((t): t is VolRoleToken => t !== null);
  const wantAllVols = groups.includes("volunteers") || (!!captainScope && tokens.length === 0);
  if (wantAllVols || tokens.length > 0) {
    for (const v of (await getVolunteers()).rows) {
      if (v.optedOut) continue; // roster opt-out suppresses even a stale opted_in row
      if (captainScope && lc(v.captainEmail) !== captainScope) continue; // scope: only my team
      const e = toE164(v.phone);
      if (!e || !opted.has(e)) continue;
      if (wantAllVols || volMatches(v, tokens)) add(e, firstOf(v.name));
    }
  }

  // Clerk account-role cohorts are a full-list source — never reached under a captain scope.
  // Each role scan pages the full Clerk userbase (no server-side metadata filter), so
  // fan them out in parallel rather than one role at a time.
  if (!captainScope) {
    const perRole = await Promise.all(roles.map((role) => listClerkContactsByRole(role)));
    for (const contacts of perRole) {
      for (const c of contacts) {
        const e = c.phone ? toE164(c.phone) : null;
        if (e && opted.has(e)) add(e, firstOf(c.firstName));
      }
    }
  }

  // Targeting filter last: narrow the resolved set by consent-row fields.
  const targetTokens = (opts.targets ?? []).map(parseTargetToken).filter((t): t is TargetToken => t !== null);
  const out = [...byPhone].map(([phone, first]) => ({ phone, first }));
  return targetTokens.length ? out.filter((r) => rowMatchesTargets(rowByPhone.get(r.phone), targetTokens)) : out;
}

// Opted-in counts per targeting token (county chips, segment chips, outstanding),
// for the composer. Counted over the whole opted-in ledger with the same matcher
// the resolver uses, so a chip's count is exactly the most that token can reach.
export async function smsTargetCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const o of [...TARGET_COUNTY_OPTIONS, ...TARGET_SEGMENT_OPTIONS, ...TARGET_DISTRICT_OPTIONS]) counts[o.value] = 0;
  counts[OUTSTANDING_TOKEN] = 0;
  try {
    for (const row of await listConsent()) {
      if (row.status !== "opted_in") continue;
      if (row.county) {
        const key = `county:${row.county}`;
        if (key in counts) counts[key]++;
      }
      if (row.voterSegment) {
        const key = `segment:${row.voterSegment}`;
        if (key in counts) counts[key]++;
      }
      if (row.schoolDistrict) {
        const key = `district:${row.schoolDistrict}`;
        if (key in counts) counts[key]++;
      }
      if (row.banked !== true) counts[OUTSTANDING_TOKEN]++;
    }
  } catch {
    /* no DB → zeros */
  }
  return counts;
}

// Opted-in count of a captain's OWN team, for the composer's "Texting your team only — N"
// banner. Same filter as the resolver under captain scope (opted-in ∩ not-blocked ∩
// not-opted-out ∩ captainEmail match) so the shown count matches what actually sends.
export async function smsCaptainTeamCount(captainEmail: string | null | undefined): Promise<number> {
  const me = lc(captainEmail);
  if (!me) return 0;
  try {
    const [opted, blocked] = await Promise.all([optedInSet(), listBlocked()]);
    const blockedSet = new Set(blocked.map((b) => b.phone));
    let n = 0;
    for (const v of (await getVolunteers()).rows) {
      if (v.optedOut || lc(v.captainEmail) !== me) continue;
      const e = toE164(v.phone);
      if (e && opted.has(e) && !blockedSet.has(e)) n++;
    }
    return n;
  } catch {
    return 0; // no DB → 0
  }
}

// Opted-in counts per group, for the composer's audience toggles. Mirrors the resolver's
// filters (opted-in ∩ not-opted-out) so the displayed count matches what actually sends.
export async function smsAudienceCounts(): Promise<Record<SmsGroup, number>> {
  const opted = await optedInSet();
  let volunteers = 0;
  try {
    for (const v of (await getVolunteers()).rows) {
      if (v.optedOut) continue;
      const e = toE164(v.phone);
      if (e && opted.has(e)) volunteers++;
    }
  } catch {
    /* no DB → 0 */
  }
  return { subscribers: opted.size, volunteers };
}

// Opted-in count per volunteer-role token, for the composer chips. Same filter as the
// resolver (opted-in ∩ not-blocked ∩ not-opted-out) so count and send can't diverge.
// Pass `captainEmail` to scope the counts to that captain's OWN team (for the captain
// composer), matching the resolver's captain scope so the chip counts don't overstate.
export async function smsVolRoleCounts(captainEmail?: string): Promise<Record<string, number>> {
  const me = lc(captainEmail);
  const counts: Record<string, number> = {};
  for (const o of VOL_ROLE_OPTIONS) counts[o.value] = 0;
  try {
    const [opted, blocked] = await Promise.all([optedInSet(), listBlocked()]);
    const blockedSet = new Set(blocked.map((b) => b.phone));
    for (const v of (await getVolunteers()).rows) {
      if (v.optedOut) continue;
      if (me && lc(v.captainEmail) !== me) continue; // captain scope: only my team
      const e = toE164(v.phone);
      if (!e || !opted.has(e) || blockedSet.has(e)) continue;
      for (const r of v.roles ?? []) {
        const key = `role:${r}`;
        if (key in counts) counts[key]++;
      }
      if (v.door) {
        const key = `door:${v.door}`;
        if (key in counts) counts[key]++;
      }
    }
  } catch {
    /* no DB → zeros */
  }
  return counts;
}
