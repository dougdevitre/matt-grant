"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { sesEnabled } from "@/lib/email/send";
import { sendBroadcastEmail } from "@/lib/campaignSend";
import { getBroadcast } from "@/lib/email/broadcasts";
import { createCampaign, drainOnce } from "@/lib/campaigns";
import { resolveRecipients } from "@/lib/email/audiences";
import { isContactGroup, audienceLabel, type ContactGroup } from "@/lib/email/audienceGroups";
import { isIssueId } from "@/lib/integrations/research/issues";
import { isWayToHelp } from "@/lib/profile";

export type SendState = { ok: boolean; message: string };

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

// Parse the composer form: a template, any number of contact groups, an optional
// supporter segment, and the template's variable fields.
function parse(formData: FormData) {
  const broadcast = getBroadcast(String(formData.get("templateKey") ?? ""));
  const groups = formData.getAll("groups").map(String).filter(isContactGroup) as ContactGroup[];
  const segRaw = String(formData.get("segment") ?? "").trim();
  const segment =
    (segRaw.startsWith("issue:") && isIssueId(segRaw.slice(6))) || (segRaw.startsWith("way:") && isWayToHelp(segRaw.slice(4)))
      ? segRaw
      : undefined;
  const vars: Record<string, string> = {};
  const missing: string[] = [];
  if (broadcast) {
    for (const f of broadcast.fields) {
      const val = String(formData.get(f.name) ?? "").trim();
      vars[f.name] = val;
      if (f.required && !val) missing.push(f.label);
    }
  }
  return { broadcast, groups, segment, vars, missing };
}

// Draft + test-to-self: captains and admins.
export async function sendTestCampaign(formData: FormData): Promise<SendState> {
  const g = await staffGate();
  if (!can(g.role, "draftEmailCampaign")) return { ok: false, message: "Not allowed." };
  if (!sesEnabled) return { ok: false, message: "Email sending isn't configured yet (set SES_FROM)." };
  if (!g.email) return { ok: false, message: "Your account has no email to send a test to." };
  const { broadcast, vars, missing } = parse(formData);
  if (!broadcast) return { ok: false, message: "Pick a template first." };
  if (missing.length) return { ok: false, message: `Fill required fields: ${missing.join(", ")}.` };
  const email = broadcast.build(vars);
  await sendBroadcastEmail({ to: g.email, email: { ...email, subject: `[TEST] ${email.subject}` }, base: await baseUrl() });
  return { ok: true, message: `Test sent to ${g.email}.` };
}

// Send to the selected groups: admins only. Queues, then sends the first batch inline.
export async function sendCampaign(formData: FormData): Promise<SendState> {
  const g = await staffGate();
  if (!can(g.role, "sendEmailCampaign")) return { ok: false, message: "Only admins can send to the list." };
  if (!sesEnabled) return { ok: false, message: "Email sending isn't configured yet (set SES_FROM)." };
  const { broadcast, groups, segment, vars, missing } = parse(formData);
  if (!broadcast) return { ok: false, message: "Pick a template first." };
  if (missing.length) return { ok: false, message: `Fill required fields: ${missing.join(", ")}.` };
  if (groups.length === 0 && !segment) return { ok: false, message: "Pick at least one group to send to." };

  const { recipients, internal } = await resolveRecipients(groups, segment);
  if (recipients.length === 0) return { ok: false, message: "No recipients for that selection." };

  const subjectPreview = broadcast.build(vars).subject;
  const rawWhen = String(formData.get("scheduledAt") ?? "").trim();
  let scheduledAt: string | undefined;
  if (rawWhen) {
    const d = new Date(rawWhen);
    // Reject unparseable or absurdly-far-future dates (a fat-fingered year 2500
    // would otherwise sit in the queue indefinitely). Cap at 90 days out; past
    // dates fall through and send immediately via the !future path below.
    const maxAt = Date.now() + 90 * 86_400_000;
    if (isNaN(d.getTime())) {
      return { ok: false, message: "That send time isn't a valid date." };
    }
    if (d.getTime() > maxAt) {
      return { ok: false, message: "Pick a send time within the next 90 days." };
    }
    scheduledAt = d.toISOString();
  }
  const future = !!scheduledAt && scheduledAt > new Date().toISOString();

  await createCampaign({
    templateKey: broadcast.key,
    topic: broadcast.topic,
    vars,
    audience: audienceLabel(groups, segment),
    recipients,
    subjectPreview,
    createdBy: g.email ?? "system",
    scheduledAt: future ? scheduledAt : undefined,
    internal,
  });

  // Scheduled: the cron drain picks it up at its time. Immediate: send the first
  // batch inline now; the cron drains the rest.
  if (future) {
    revalidatePath("/dashboard/emails");
    return { ok: true, message: `Scheduled for ${rawWhen.replace("T", " ")} — ${recipients.length} recipients. It sends automatically.` };
  }
  let progressed: Awaited<ReturnType<typeof drainOnce>> = null;
  try {
    progressed = await drainOnce(await baseUrl());
  } catch {
    /* cron worker will continue */
  }
  revalidatePath("/dashboard/emails");
  return {
    ok: true,
    message: progressed?.done
      ? `Sent to ${progressed.sent} of ${recipients.length}.`
      : `Queued ${recipients.length} recipients — sending in the background${internal ? " (team send — honors unsubscribes only)" : " (skips anyone opted out of this topic)"}. Track progress below.`,
  };
}
