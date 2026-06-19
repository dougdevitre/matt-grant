"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getDonors, getVolunteers } from "@/lib/queries";
import { sesEnabled } from "@/lib/email/send";
import { sendCampaignEmail } from "@/lib/campaignSend";
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
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const a = String(formData.get("audience") ?? "all");
  const audience: Audience = a === "volunteers" || a === "donors" ? a : "all";
  return { subject, body, audience };
}

// Drafting (and a test to yourself) is open to captains + admins.
export async function sendTestCampaign(formData: FormData): Promise<SendState> {
  const g = await staffGate();
  if (!can(g.role, "draftEmailCampaign")) return { ok: false, message: "Not allowed." };
  if (!sesEnabled) return { ok: false, message: "Email sending isn't configured yet (set SES_FROM)." };
  if (!g.email) return { ok: false, message: "Your account has no email to send a test to." };
  const { subject, body } = parse(formData);
  if (!subject || !body) return { ok: false, message: "Add a subject and body first." };
  await sendCampaignEmail({ to: g.email, subject, body, base: await baseUrl(), test: true });
  return { ok: true, message: `Test sent to ${g.email}.` };
}

// Sending to the list is admins-only. We QUEUE the campaign and send the first
// bounded batch inline (so small lists finish instantly); the rest is delivered
// by the /api/cron/email-drain worker — no single request risks a timeout.
export async function sendCampaign(formData: FormData): Promise<SendState> {
  const g = await staffGate();
  if (!can(g.role, "sendEmailCampaign")) return { ok: false, message: "Only admins can send to the list." };
  if (!sesEnabled) return { ok: false, message: "Email sending isn't configured yet (set SES_FROM)." };
  const { subject, body, audience } = parse(formData);
  if (!subject || !body) return { ok: false, message: "Add a subject and body first." };

  const recipients = await recipientsFor(audience);
  if (recipients.length === 0) return { ok: false, message: "No recipients for that audience." };

  await createCampaign({ subject, body, audience, recipients, createdBy: g.email ?? "system" });
  let progressed: Awaited<ReturnType<typeof drainOnce>> = null;
  try {
    progressed = await drainOnce(await baseUrl());
  } catch {
    /* the cron worker will pick it up */
  }
  revalidatePath("/dashboard/emails");

  return {
    ok: true,
    message: progressed?.done
      ? `Sent to ${progressed.sent} of ${recipients.length}.`
      : `Queued ${recipients.length} recipients — sending in the background. Track progress below.`,
  };
}
