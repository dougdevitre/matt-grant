import { getVolunteers } from "@/lib/queries";
import { optedInSet } from "@/lib/sms/consent";
import { toE164 } from "@/lib/sms/send";

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

export function smsAudienceLabel(groups: SmsGroup[]): string {
  return groups.map((g) => SMS_GROUP_LABELS[g]).join(" + ") || "—";
}

// E.164 phones from the chosen groups, filtered to opted-in and de-duplicated.
export async function resolveSmsRecipients(groups: SmsGroup[]): Promise<string[]> {
  const opted = await optedInSet();
  const out = new Set<string>();
  if (groups.includes("subscribers")) for (const p of opted) out.add(p);
  if (groups.includes("volunteers")) {
    const vols = (await getVolunteers()).rows;
    for (const v of vols) {
      const e = toE164(v.phone);
      if (e && opted.has(e)) out.add(e);
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
