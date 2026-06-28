import { getVolunteers } from "@/lib/queries";
import { optedInSet } from "@/lib/sms/consent";
import { listBlocked } from "@/lib/sms/moderation";
import { toE164 } from "@/lib/sms/send";
import { listClerkContactsByRole } from "@/lib/clerkAudiences";
import { ROLE_LABELS, type Role } from "@/lib/rbac";

// Resolve SMS broadcast recipients. Unlike email, the audience is gated on
// recorded opt-in: every candidate number is intersected with optedInSet(), so
// the result is opted-in BY CONSTRUCTION (the drain re-checks at send too, in
// case someone texts STOP between queueing and sending). Donors carry no phone,
// so they're not a source — volunteers are the only contact store with numbers.
export const SMS_GROUPS = ["subscribers", "volunteers"] as const;
export type SmsGroup = (typeof SMS_GROUPS)[number];

export const SMS_GROUP_LABELS: Record<SmsGroup, string> = {
  subscribers: "All opted-in",
  volunteers: "Volunteers",
};

export function isSmsGroup(v: string): v is SmsGroup {
  return (SMS_GROUPS as readonly string[]).includes(v);
}

export function smsAudienceLabel(groups: SmsGroup[], roles: Role[] = []): string {
  const parts = groups.map((g) => SMS_GROUP_LABELS[g]);
  for (const r of roles) parts.push(`Role: ${ROLE_LABELS[r]}`);
  return parts.join(" + ") || "—";
}

// E.164 phones from the chosen groups + Clerk roles, filtered to opted-in, minus blocked
// numbers, and de-duplicated. Role recipients are gated on opt-in BY CONSTRUCTION too — a
// Clerk account with role X is only texted if its phone is in the consent ledger. (The drain
// re-checks opt-in + block at send.)
export async function resolveSmsRecipients(groups: SmsGroup[], roles: Role[] = []): Promise<string[]> {
  const [opted, blocked] = await Promise.all([optedInSet(), listBlocked()]);
  const blockedSet = new Set(blocked.map((b) => b.phone));
  const out = new Set<string>();
  const add = (e: string) => {
    if (!blockedSet.has(e)) out.add(e);
  };
  if (groups.includes("subscribers")) for (const p of opted) add(p);
  if (groups.includes("volunteers")) {
    const vols = (await getVolunteers()).rows;
    for (const v of vols) {
      const e = toE164(v.phone);
      if (e && opted.has(e)) add(e);
    }
  }
  for (const role of roles) {
    for (const c of await listClerkContactsByRole(role)) {
      const e = c.phone ? toE164(c.phone) : null;
      if (e && opted.has(e)) add(e);
    }
  }
  return [...out];
}

// Opted-in counts per group, for the composer's audience toggles.
export async function smsAudienceCounts(): Promise<Record<SmsGroup, number>> {
  const opted = await optedInSet();
  let volunteers = 0;
  try {
    for (const v of (await getVolunteers()).rows) {
      const e = toE164(v.phone);
      if (e && opted.has(e)) volunteers++;
    }
  } catch {
    /* no DB → 0 */
  }
  return { subscribers: opted.size, volunteers };
}
