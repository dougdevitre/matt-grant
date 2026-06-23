"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { smsEnabled, toE164, sendSms } from "@/lib/sms/send";
import { isOptedIn } from "@/lib/sms/consent";
import { getSmsTemplate, withCompliance } from "@/lib/sms/templates";
import { createSmsCampaign, drainSmsOnce } from "@/lib/sms/campaigns";
import { resolveSmsRecipients, smsAudienceLabel, isSmsGroup, type SmsGroup } from "@/lib/sms/audiences";

export type SmsSendState = { ok: boolean; message: string };

function parse(formData: FormData) {
  const template = getSmsTemplate(String(formData.get("templateKey") ?? ""));
  const groups = formData.getAll("groups").map(String).filter(isSmsGroup) as SmsGroup[];
  const vars: Record<string, string> = {};
  if (template) for (const f of template.fields) vars[f.name] = String(formData.get(f.name) ?? "").trim();
  const body = template ? withCompliance(template.build(vars)) : "";
  return { template, groups, body };
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
  const r = await sendSms({ to, body });
  return r.sent ? { ok: true, message: `Test sent to ${to}.` } : { ok: false, message: `Couldn't send: ${r.error ?? "unknown error"}.` };
}

// Send to the selected opted-in audience: admins only. Queues, then drains the
// first batch inline (unless it's quiet hours, when the cron picks it up).
export async function sendSmsCampaign(formData: FormData): Promise<SmsSendState> {
  const g = await staffGate();
  if (!can(g.role, "sendSms")) return { ok: false, message: "Only admins can send to the list." };
  if (!(await smsEnabled())) return { ok: false, message: "Texting isn't configured yet (add Twilio credentials)." };
  const { template, groups, body } = parse(formData);
  if (!template) return { ok: false, message: "Pick a template first." };
  if (!body) return { ok: false, message: "Write a message first." };
  if (groups.length === 0) return { ok: false, message: "Pick at least one audience." };

  const recipients = await resolveSmsRecipients(groups);
  if (recipients.length === 0) return { ok: false, message: "No opted-in recipients for that selection." };

  const rawWhen = String(formData.get("scheduledAt") ?? "").trim();
  let scheduledAt: string | undefined;
  if (rawWhen) {
    const d = new Date(rawWhen);
    if (!isNaN(d.getTime())) scheduledAt = d.toISOString();
  }
  const future = !!scheduledAt && scheduledAt > new Date().toISOString();

  await createSmsCampaign({
    body,
    audience: smsAudienceLabel(groups),
    recipients,
    createdBy: g.email ?? "system",
    scheduledAt: future ? scheduledAt : undefined,
  });

  if (future) {
    revalidatePath("/dashboard/sms");
    return { ok: true, message: `Scheduled for ${rawWhen.replace("T", " ")} — ${recipients.length} opted-in recipients. It sends automatically.` };
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
      ? `Sent to ${progressed.sent} of ${recipients.length}.`
      : `Queued ${recipients.length} opted-in recipients — sending in the background (respects quiet hours, 9am–8pm CT). Track progress below.`,
  };
}
