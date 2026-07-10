import { getVolunteers } from "@/lib/queries";
import { optedInSet } from "@/lib/sms/consent";
import { listBlocked } from "@/lib/sms/moderation";
import { toE164 } from "@/lib/sms/send";
import { listClerkContactsByRole } from "@/lib/clerkAudiences";
import { ROLE_LABELS, type Role } from "@/lib/rbac";
import { VOLUNTEER_ROLES, JOIN_DOORS, isVolunteerRole, isJoinDoor } from "@/lib/volunteer/taxonomy";

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

export function smsAudienceLabel(groups: SmsGroup[], roles: Role[] = [], volRoles: string[] = []): string {
  const parts = groups.map((g) => SMS_GROUP_LABELS[g]);
  for (const r of roles) parts.push(`Role: ${ROLE_LABELS[r]}`);
  for (const t of volRoles) {
    const opt = VOL_ROLE_OPTIONS.find((o) => o.value === t);
    if (opt) parts.push(opt.label);
  }
  return parts.join(" + ") || "—";
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
export type SmsResolveOpts = { captainEmail?: string };

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
  const [opted, blocked] = await Promise.all([optedInSet(), listBlocked()]);
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
  return [...byPhone].map(([phone, first]) => ({ phone, first }));
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
