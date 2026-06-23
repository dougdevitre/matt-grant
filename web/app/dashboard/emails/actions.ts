"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getDonors, getVolunteers } from "@/lib/queries";
import { sesEnabled } from "@/lib/email/send";
import { sendBroadcastEmail } from "@/lib/campaignSend";
import { getBroadcast } from "@/lib/email/broadcasts";
import { createCampaign, drainOnce, type Recipient } from "@/lib/campaigns";
import { segmentEmails, isWayToHelp } from "@/lib/profile";
import { isIssueId } from "@/lib/integrations/research/issues";

export type SendState = { ok: boolean; message: string };
// Audience is a staff list (volunteers/donors/all) OR a profile segment:
// "issue:<id>" (cares about a priority) or "way:<wayToHelp>" (wants to volunteer,
// host, …) — both come from the supporter's onboarding profile.
export type Audience = "volunteers" | "donors" | "all" | `issue:${string}` | `way:${string}`;

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

// First token of a stored full name → the {{first_name}} merge value. Profile
// segments store no name, so those recipients fall back to a neutral greeting.
const firstNameOf = (name?: string | null): string | undefined => (name ?? "").trim().split(/\s+/)[0] || undefined;

async function recipientsFor(audience: Audience): Promise<Recipient[]> {
  const byEmail = new Map<string, Recipient>();
  const add = (email?: string | null, firstName?: string) => {
    if (!email) return;
    const e = email.toLowerCase();
    const existing = byEmail.get(e);
    if (!existing) byEmail.set(e, firstName ? { email: e, firstName } : { email: e });
    else if (!existing.firstName && firstName) existing.firstName = firstName; // keep the first name we learn for this address
  };

  // Profile segments (supporter-driven). Interest, or way-they-want-to-help.
  if (audience.startsWith("issue:")) {
    const issue = audience.slice("issue:".length);
    if (isIssueId(issue)) (await segmentEmails({ issue })).forEach((e) => add(e));
    return [...byEmail.values()];
  }
  if (audience.startsWith("way:")) {
    const wayToHelp = audience.slice("way:".length);
    if (isWayToHelp(wayToHelp)) (await segmentEmails({ wayToHelp })).forEach((e) => add(e));
    return [...byEmail.values()];
  }
  if (audience === "volunteers" || audience === "all") {
    const { rows } = await getVolunteers();
    rows.forEach((v) => add(v.email, firstNameOf(v.name)));
  }
  if (audience === "donors" || audience === "all") {
    const { rows } = await getDonors();
    rows.forEach((d) => add(d.email, firstNameOf(d.name)));
  }
  return [...byEmail.values()];
}

function parse(formData: FormData) {
  const broadcast = getBroadcast(String(formData.get("templateKey") ?? ""));
  const a = String(formData.get("audience") ?? "all");
  const validSegment =
    (a.startsWith("issue:") && isIssueId(a.slice("issue:".length))) ||
    (a.startsWith("way:") && isWayToHelp(a.slice("way:".length)));
  const audience: Audience = a === "volunteers" || a === "donors" ? a : validSegment ? (a as Audience) : "all";
  const vars: Record<string, string> = {};
  const missing: string[] = [];
  if (broadcast) {
    for (const f of broadcast.fields) {
      const val = String(formData.get(f.name) ?? "").trim();
      vars[f.name] = val;
      if (f.required && !val) missing.push(f.label);
    }
  }
  return { broadcast, audience, vars, missing };
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

// Send to the list: admins only. Queues, then sends the first batch inline.
export async function sendCampaign(formData: FormData): Promise<SendState> {
  const g = await staffGate();
  if (!can(g.role, "sendEmailCampaign")) return { ok: false, message: "Only admins can send to the list." };
  if (!sesEnabled) return { ok: false, message: "Email sending isn't configured yet (set SES_FROM)." };
  const { broadcast, audience, vars, missing } = parse(formData);
  if (!broadcast) return { ok: false, message: "Pick a template first." };
  if (missing.length) return { ok: false, message: `Fill required fields: ${missing.join(", ")}.` };

  const recipients = await recipientsFor(audience);
  if (recipients.length === 0) return { ok: false, message: "No recipients for that audience." };

  const subjectPreview = broadcast.build(vars).subject;
  const rawWhen = String(formData.get("scheduledAt") ?? "").trim();
  let scheduledAt: string | undefined;
  if (rawWhen) {
    const d = new Date(rawWhen);
    if (!isNaN(d.getTime())) scheduledAt = d.toISOString();
  }
  const future = !!scheduledAt && scheduledAt > new Date().toISOString();

  await createCampaign({
    templateKey: broadcast.key,
    topic: broadcast.topic,
    vars,
    audience,
    recipients,
    subjectPreview,
    createdBy: g.email ?? "system",
    scheduledAt: future ? scheduledAt : undefined,
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
      : `Queued ${recipients.length} recipients — sending in the background (skips anyone opted out of this topic). Track progress below.`,
  };
}
