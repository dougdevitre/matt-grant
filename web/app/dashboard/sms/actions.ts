"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { smsEnabled, toE164, sendSms } from "@/lib/sms/send";
import { isOptedIn } from "@/lib/sms/consent";
import { getSmsTemplate, withCompliance } from "@/lib/sms/templates";
import { createSmsCampaign, drainSmsOnce } from "@/lib/sms/campaigns";
import { resolveSmsRecipients, smsAudienceLabel, isSmsGroup, parseVolRole, parseTargetToken, type SmsGroup } from "@/lib/sms/audiences";
import { rankForBroadcast, toSegment } from "@/lib/reports/smsTargeting";
import { asRole, type Role } from "@/lib/rbac";

export type SmsSendState = { ok: boolean; message: string };

function parse(formData: FormData) {
  const template = getSmsTemplate(String(formData.get("templateKey") ?? ""));
  const groups = formData.getAll("groups").map(String).filter(isSmsGroup) as SmsGroup[];
  const roles = formData.getAll("roleGroups").map(String).map(asRole).filter((r): r is Role => r !== null);
  const volRoles = formData.getAll("volRoles").map(String).filter((t) => parseVolRole(t) !== null);
  // Targeting tokens (county/zip/segment/outstanding) NARROW the audience; invalid
  // tokens are dropped here and re-validated in the resolver, so they never widen.
  const targets = formData.getAll("targets").map(String).filter((t) => parseTargetToken(t) !== null);
  const vars: Record<string, string> = {};
  if (template) for (const f of template.fields) vars[f.name] = String(formData.get(f.name) ?? "").trim();
  // Personalize: prepend a "Hi {first}, " greeting (a literal {first} merge token the drain
  // replaces per recipient). Volunteers/role audiences carry a name; others fall back to "there".
  const personalize = String(formData.get("personalize") ?? "") === "true";
  const built = template ? template.build(vars) : "";
  const greeted = personalize && built ? `Hi {first}, ${built}` : built;
  const body = template ? withCompliance(greeted) : "";
  return { template, groups, roles, volRoles, targets, body };
}

// Draft + test-to-a-number: captains and admins. The number must already be opted in.
export async function sendTestSms(formData: FormData): Promise<SmsSendState> {
  const g = await staffGate();
  if (!can(g.role, "draftSms")) return { ok: false, message: "Not allowed." };
  if (!(await smsEnabled())) return { ok: false, message: "Texting isn't configured yet (add Twilio credentials)." };
  const { template, body } = parse(formData);
  if (!template) return { ok: false, message: "Pick a template first." };
  if (!body) return { ok: false, message: "Write a message first." };
  const to = toE164(String(formData.get("testTo") ?? ""));
  if (!to) return { ok: false, message: "Enter a valid mobile number, e.g. +13145551234." };
  if (!(await isOptedIn(to))) return { ok: false, message: `${to} isn't opted in — that number must text the opt-in keyword first.` };
  // A test is a preview: resolve any {first} merge token to "there" so it isn't sent literally.
  const r = await sendSms({ to, body: body.replace(/\{first\}/g, "there") });
  return r.sent ? { ok: true, message: `Test sent to ${to}.` } : { ok: false, message: `Couldn't send: ${r.error ?? "unknown error"}.` };
}

// Send to the selected opted-in audience. Admins send to the full list; captains
// send to their OWN opted-in team only (sendTeamSms) — scope is enforced in the
// resolver, so a captain can never widen past their roster. Queues, then drains the
// first batch inline (unless it's quiet hours, when the cron picks it up).
export async function sendSmsCampaign(formData: FormData): Promise<SmsSendState> {
  const g = await staffGate();
  const isAdmin = can(g.role, "sendSms");
  const isCaptain = !isAdmin && can(g.role, "sendTeamSms");
  if (!isAdmin && !isCaptain) return { ok: false, message: "You don't have permission to send SMS broadcasts." };
  // Trim to match how the resolver scopes (lc(email) === trim+lower). A whitespace-only
  // email would otherwise pass a raw `!g.email` guard but trim to "" in the resolver →
  // captainScope falsy → an unscoped full-list send. Reject it here so guard and scope agree.
  const captainEmail = (g.email ?? "").trim();
  if (isCaptain && !captainEmail) return { ok: false, message: "Your account has no email on file — can't scope the send to your team." };
  if (!(await smsEnabled())) return { ok: false, message: "Texting isn't configured yet (add Twilio credentials)." };
  const { template, groups, roles, volRoles, targets, body } = parse(formData);
  if (!template) return { ok: false, message: "Pick a template first." };
  if (!body) return { ok: false, message: "Write a message first." };
  // A captain always targets their own team (optionally sub-filtered by volunteer role);
  // an admin must pick at least one audience/role (targeting filters only narrow one).
  if (isAdmin && groups.length === 0 && roles.length === 0 && volRoles.length === 0)
    return { ok: false, message: "Pick at least one audience or role." };

  // Captain scope drops subscribers/account-roles server-side, so a tampered form can't widen it.
  const opts = isCaptain ? { captainEmail, targets } : { targets };
  const resolved = await resolveSmsRecipients(groups, roles, volRoles, opts);
  if (resolved.length === 0)
    return { ok: false, message: isCaptain ? "No opted-in volunteers on your team for that selection." : "No opted-in recipients for that selection." };

  // Queue highest-likelihood voters FIRST (candidate/sms-targeting-plan.md):
  // segment weight then turnout tie-break, from the denormalized consent-row tags.
  // Nobody is dropped by the ranking itself — unscored numbers simply go last —
  // and the optional cap (admin-entered) trims the lowest-priority tail only.
  const rawCap = Number(String(formData.get("maxTexts") ?? "").trim());
  const cap = Number.isFinite(rawCap) && rawCap > 0 ? Math.floor(rawCap) : undefined;
  const ranking = rankForBroadcast(
    resolved.map((r) => ({ phone: r.phone, first: r.first, segment: toSegment(r.voterSegment), t: r.voterT })),
    cap,
  );
  const recipients = ranking.ordered.map((r) => ({ phone: r.phone, first: r.first }));
  const cappedNote = ranking.capped ? ` Capped to the ${recipients.length} highest-priority of ${ranking.total}.` : "";

  const rawWhen = String(formData.get("scheduledAt") ?? "").trim();
  let scheduledAt: string | undefined;
  if (rawWhen) {
    const d = new Date(rawWhen);
    if (!isNaN(d.getTime())) scheduledAt = d.toISOString();
  }
  const future = !!scheduledAt && scheduledAt > new Date().toISOString();

  const audience = isCaptain
    ? `My team${volRoles.length || targets.length ? ` · ${smsAudienceLabel([], [], volRoles, targets)}` : ""}`
    : smsAudienceLabel(groups, roles, volRoles, targets);
  await createSmsCampaign({
    body,
    audience,
    recipients,
    createdBy: g.email ?? "system",
    scheduledAt: future ? scheduledAt : undefined,
  });

  if (future) {
    revalidatePath("/dashboard/sms");
    return { ok: true, message: `Scheduled for ${rawWhen.replace("T", " ")} — ${recipients.length} opted-in recipients, highest-likelihood voters first.${cappedNote} It sends automatically.` };
  }
  let progressed: Awaited<ReturnType<typeof drainSmsOnce>> = null;
  try {
    progressed = await drainSmsOnce();
  } catch {
    /* cron worker continues */
  }
  revalidatePath("/dashboard/sms");
  return {
    ok: true,
    message: progressed?.done
      ? `Sent to ${progressed.sent} of ${recipients.length}.${cappedNote}`
      : `Queued ${recipients.length} opted-in recipients, highest-likelihood voters first.${cappedNote} Sending in the background (respects quiet hours, 9am–8pm CT). Track progress below.`,
  };
}
