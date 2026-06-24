"use server";

import { revalidatePath } from "next/cache";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK } from "@/lib/db";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { smsEnabled, toE164 } from "@/lib/sms/send";
import { sendDirectMessage, linkConversationEmail, archiveConversation, markRead } from "@/lib/sms/conversations";
import { blockNumber, unblockNumber } from "@/lib/sms/moderation";
import { inviteToClerk } from "@/lib/clerkRoles";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { renderEmail, renderText } from "@/lib/email/layout";
import { SITE_URL } from "@/lib/site";

export type MsgState = { ok: boolean; message: string; phone?: string };

async function gate(): Promise<{ email: string | null } | null> {
  const g = await staffGate();
  return g.ok && can(g.role, "messageIndividuals") ? { email: g.email } : null;
}

function refresh(phone: string) {
  revalidatePath("/dashboard/messages");
  revalidatePath(`/dashboard/messages/${encodeURIComponent(phone)}`);
}

// Start a new 1:1 conversation (or message an existing person by number).
export async function sendNewMessage(formData: FormData): Promise<MsgState> {
  const g = await gate();
  if (!g) return { ok: false, message: "Not allowed." };
  if (!(await smsEnabled())) return { ok: false, message: "Texting isn't configured yet (add Twilio credentials)." };
  const to = toE164(String(formData.get("to") ?? ""));
  if (!to) return { ok: false, message: "Enter a valid US mobile number, e.g. +13145551234." };
  const r = await sendDirectMessage({ to, body: String(formData.get("body") ?? ""), by: g.email ?? "system" });
  if (!r.sent) return { ok: false, message: r.reason ?? "Couldn't send." };
  refresh(to);
  return { ok: true, message: "Sent.", phone: to };
}

// Reply within an existing thread.
export async function replyMessage(formData: FormData): Promise<MsgState> {
  const g = await gate();
  if (!g) return { ok: false, message: "Not allowed." };
  if (!(await smsEnabled())) return { ok: false, message: "Texting isn't configured yet (add Twilio credentials)." };
  const to = toE164(String(formData.get("phone") ?? ""));
  if (!to) return { ok: false, message: "Bad number." };
  const r = await sendDirectMessage({ to, body: String(formData.get("body") ?? ""), by: g.email ?? "system" });
  if (!r.sent) return { ok: false, message: r.reason ?? "Couldn't send." };
  refresh(to);
  return { ok: true, message: "Sent.", phone: to };
}

// Block / unblock a number (plain form actions; ConfirmButton gates the click).
export async function blockNumberAction(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const phone = toE164(String(formData.get("phone") ?? ""));
  if (!phone) return;
  await blockNumber({ phone, by: g.email ?? "system", reason: String(formData.get("reason") ?? "") || undefined });
  refresh(phone);
}

export async function unblockNumberAction(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const phone = toE164(String(formData.get("phone") ?? ""));
  if (!phone) return;
  await unblockNumber(phone);
  refresh(phone);
}

// Bulk inbox triage — apply one operation across the conversations the staffer
// selected in the list. Each op reuses the existing single-conversation helper,
// so behavior matches the per-thread controls. Numbers are normalized + deduped
// and invalid ones dropped, so a malformed selection can't write junk.
export type BulkOp = "archive" | "markRead" | "block";

export async function bulkConversationAction(phones: string[], op: BulkOp): Promise<MsgState> {
  const g = await gate();
  if (!g) return { ok: false, message: "Not allowed." };
  const valid = Array.from(new Set(phones.map((p) => toE164(p)).filter((p): p is string => !!p)));
  if (valid.length === 0) return { ok: false, message: "Select at least one conversation." };
  for (const phone of valid) {
    if (op === "archive") await archiveConversation(phone, true);
    else if (op === "markRead") await markRead(phone);
    else await blockNumber({ phone, by: g.email ?? "system", reason: "Bulk block from inbox" });
  }
  revalidatePath("/dashboard/messages");
  const verb = op === "archive" ? "archived" : op === "markRead" ? "marked read" : "blocked";
  return { ok: true, message: `${valid.length} ${valid.length === 1 ? "conversation" : "conversations"} ${verb}.` };
}

// Conversion path A — text the person a self-signup link. They register
// themselves (no email needed up front); the Clerk user.created webhook then
// stamps the "supporter" role automatically. Goes through the same consent gate
// as any 1:1 send, so it only reaches someone who texted us first or is opted in.
export async function sendSignupLink(formData: FormData): Promise<MsgState> {
  const g = await gate();
  if (!g) return { ok: false, message: "Not allowed." };
  if (!(await smsEnabled())) return { ok: false, message: "Texting isn't configured yet (add Twilio credentials)." };
  const to = toE164(String(formData.get("phone") ?? ""));
  if (!to) return { ok: false, message: "Bad number." };
  const body = `Thanks for texting Matt Grant for Congress! Join the community and follow the campaign here: ${SITE_URL}/sign-up`;
  const r = await sendDirectMessage({ to, body, by: g.email ?? "system" });
  if (!r.sent) return { ok: false, message: r.reason ?? "Couldn't send." };
  refresh(to);
  return { ok: true, message: "Sign-up link texted." };
}

// Conversion path B — register an inbound texter as a Clerk SUPPORTER directly.
// Clerk is email-only here, so a real email is required — we never fabricate one.
// Mirrors inviteStaff's flow: Clerk invitation when possible, SES note as fallback.
export async function registerTexter(formData: FormData): Promise<MsgState> {
  const g = await gate();
  if (!g) return { ok: false, message: "Not allowed." };
  const phone = toE164(String(formData.get("phone") ?? ""));
  if (!phone) return { ok: false, message: "Bad number." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, message: "Enter a real email address to register them." };
  const name = String(formData.get("name") ?? "").trim();

  let clerk = { invited: false, existing: false };
  try {
    clerk = await inviteToClerk(email, "supporter");
    // Link the contact: a volunteer row keyed by email + the conversation's phone,
    // so the inbox bridges phone ↔ person and shows the registered state.
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.volunteers, SK: `e:${email}` },
        UpdateExpression:
          "SET email = :em, phone = :ph, #src = :src, updatedAt = :u, #st = if_not_exists(#st, :new), createdAt = if_not_exists(createdAt, :u)" +
          (name ? ", #n = :n" : ""),
        ExpressionAttributeNames: { "#src": "source", "#st": "status", ...(name ? { "#n": "name" } : {}) },
        ExpressionAttributeValues: {
          ":em": email,
          ":ph": phone,
          ":src": "sms-inbox",
          ":u": new Date().toISOString(),
          ":new": "NEW",
          ...(name ? { ":n": name } : {}),
        },
      }),
    );
    await linkConversationEmail(phone, email);
  } catch {
    return { ok: false, message: "Couldn't register them. Check the database connection." };
  }

  // Clerk emails brand-new invitees directly; only send our SES note when it didn't.
  if (!clerk.invited && sesEnabled) {
    try {
      const html = renderEmail({
        eyebrow: "Matt Grant for Congress",
        title: "Thanks for reaching out.",
        bodyHtml: `<p>Thanks for texting the campaign. You can follow the race and join the community using <strong>${email}</strong>.</p>`,
        button: { label: "Join the community", href: `${SITE_URL}/sign-in`, color: "red" },
      });
      await sendEmail({
        to: email,
        subject: "Join the Matt Grant for Congress community",
        html,
        text: renderText({ title: "Join the community", lines: [`Sign in with ${email}: ${SITE_URL}/sign-in`] }),
      });
    } catch {
      /* registration recorded even if the email fails */
    }
  }

  refresh(phone);
  const message = clerk.invited
    ? `Registered ${email} — Clerk emailed them an invitation.`
    : clerk.existing
      ? `${email} already has an account — linked to this conversation.`
      : sesEnabled
        ? `Registered ${email} — an email is on the way.`
        : `Registered ${email}. (Connect Clerk to email invitations.)`;
  return { ok: true, message };
}
