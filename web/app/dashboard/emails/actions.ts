"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getDonors, getVolunteers } from "@/lib/queries";
import { sesEnabled } from "@/lib/email/send";
import { sendBroadcastEmail } from "@/lib/campaignSend";
import { getBroadcast } from "@/lib/email/broadcasts";
import { createCampaign, drainOnce } from "@/lib/campaigns";

export type SendState = { ok: boolean; message: string };
export type Audience = "volunteers" | "donors" | "all";

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

async function recipientsFor(audience: Audience): Promise<string[]> {
  const out = new Set<string>();
  if (audience === "volunteers" || audience === "all") {
    const { rows } = await getVolunteers();
    rows.forEach((v) => v.email && out.add(v.email.toLowerCase()));
  }
  if (audience === "donors" || audience === "all") {
    const { rows } = await getDonors();
    rows.forEach((d) => d.email && out.add(d.email.toLowerCase()));
  }
  return [...out];
}

function parse(formData: FormData) {
  const broadcast = getBroadcast(String(formData.get("templateKey") ?? ""));
  const a = String(formData.get("audience") ?? "all");
  const audience: Audience = a === "volunteers" || a === "donors" ? a : "all";
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
  await createCampaign({
    templateKey: broadcast.key,
    topic: broadcast.topic,
    vars,
    audience,
    recipients,
    subjectPreview,
    createdBy: g.email ?? "system",
  });
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
