"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getDonors, getVolunteers } from "@/lib/queries";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { renderEmail, renderText } from "@/lib/email/layout";
import { isSuppressed, unsubscribeUrl } from "@/lib/subscribers";
import { logCampaign } from "@/lib/campaigns";

export type SendState = { ok: boolean; message: string };
export type Audience = "volunteers" | "donors" | "all";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function bodyToHtml(body: string): string {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

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

// Anyone who can draft (admin or captain) can send a test to themselves.
export async function sendTestCampaign(formData: FormData): Promise<SendState> {
  const g = await staffGate();
  if (!can(g.role, "draftEmailCampaign")) return { ok: false, message: "Not allowed." };
  if (!sesEnabled) return { ok: false, message: "Email sending isn't configured yet (set SES_FROM)." };
  if (!g.email) return { ok: false, message: "Your account has no email to send a test to." };
  const { subject, body } = parse(formData);
  if (!subject || !body) return { ok: false, message: "Add a subject and body first." };

  const base = await baseUrl();
  const u = unsubscribeUrl(base, g.email);
  await sendEmail({
    to: g.email,
    subject: `[TEST] ${subject}`,
    html: renderEmail({ eyebrow: "Campaign update", title: subject, bodyHtml: bodyToHtml(body), unsubscribeUrl: u }),
    text: renderText({ title: subject, lines: [body], unsubscribeUrl: u }),
    tokens: { unsubscribe_url: u, preferences_url: u },
  });
  return { ok: true, message: `Test sent to ${g.email}.` };
}

// Sending to the real list is admins-only.
export async function sendCampaign(formData: FormData): Promise<SendState> {
  const g = await staffGate();
  if (!can(g.role, "sendEmailCampaign")) return { ok: false, message: "Only admins can send to the list." };
  if (!sesEnabled) return { ok: false, message: "Email sending isn't configured yet (set SES_FROM)." };
  const { subject, body, audience } = parse(formData);
  if (!subject || !body) return { ok: false, message: "Add a subject and body first." };

  const all = await recipientsFor(audience);
  const eligible: string[] = [];
  let suppressed = 0;
  for (const e of all) {
    if (await isSuppressed(e)) suppressed++;
    else eligible.push(e);
  }
  if (eligible.length === 0) return { ok: false, message: "No eligible recipients for that audience." };

  const base = await baseUrl();
  let sent = 0;
  for (const e of eligible) {
    const u = unsubscribeUrl(base, e);
    const r = await sendEmail({
      to: e,
      subject,
      html: renderEmail({ eyebrow: "Campaign update", title: subject, bodyHtml: bodyToHtml(body), unsubscribeUrl: u }),
      text: renderText({ title: subject, lines: [body], unsubscribeUrl: u }),
      tokens: { unsubscribe_url: u, preferences_url: u },
    });
    if (r.sent) sent++;
  }

  await logCampaign({ at: new Date().toISOString(), subject, audience, sentBy: g.email ?? "system", recipients: sent, suppressed });
  revalidatePath("/dashboard/emails");
  return { ok: true, message: `Sent to ${sent} recipient${sent === 1 ? "" : "s"}${suppressed ? `; skipped ${suppressed} unsubscribed` : ""}.` };
}
