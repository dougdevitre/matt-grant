import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { clerkEnabled } from "@/lib/auth";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { inviteReminder } from "@/lib/email/templates";
import { SITE_URL } from "@/lib/site";

// Remind people who were invited via Clerk but haven't accepted. Clerk is the
// source of truth for "pending" (our DynamoDB staff rows don't distinguish
// invited-vs-accepted). Reminders are bounded per run and de-duped via an
// INVITEREMINDER row so no one gets spammed. Everything degrades gracefully when
// Clerk or SES isn't configured.

export type PendingInvite = { email: string; role?: string; url?: string; createdAt: number };

async function clerk() {
  const { clerkClient } = await import("@clerk/nextjs/server");
  return clerkClient();
}

// Cheap count for the Team-page label (single call; uses totalCount).
export async function pendingInviteCount(): Promise<number> {
  if (!clerkEnabled) return 0;
  try {
    const res = await (await clerk()).invitations.getInvitationList({ status: "pending", limit: 1 });
    return Number(res?.totalCount ?? res?.data?.length ?? 0);
  } catch {
    return 0;
  }
}

// Full list of pending invitations (paginated, capped). Each carries the invitee's
// email, the role we stamped in publicMetadata, and Clerk's direct accept URL.
export async function listPendingInvites(): Promise<PendingInvite[]> {
  if (!clerkEnabled) return [];
  try {
    const client = await clerk();
    const out: PendingInvite[] = [];
    const limit = 100;
    for (let page = 0; page < 10; page++) {
      const res = await client.invitations.getInvitationList({ status: "pending", limit, offset: page * limit });
      const data = res?.data ?? [];
      for (const inv of data) {
        const email = String(inv.emailAddress ?? "").trim().toLowerCase();
        if (!email) continue;
        const role = inv.publicMetadata?.role;
        out.push({
          email,
          role: typeof role === "string" ? role : undefined,
          url: inv.url ?? undefined,
          createdAt: Number(inv.createdAt ?? 0),
        });
      }
      if (data.length < limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

async function recentlyReminded(email: string, minHours: number): Promise<boolean> {
  if (!dbConfigured) return false;
  try {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.inviteReminders, SK: email } }));
    const at = r.Item?.remindedAt ? new Date(String(r.Item.remindedAt)).getTime() : 0;
    return at > 0 && Date.now() - at < minHours * 3_600_000;
  } catch {
    return false;
  }
}

async function markReminded(email: string): Promise<void> {
  if (!dbConfigured) return;
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.inviteReminders, SK: email },
        UpdateExpression: "SET remindedAt = :t ADD #c :one",
        ExpressionAttributeNames: { "#c": "count" },
        ExpressionAttributeValues: { ":t": new Date().toISOString(), ":one": 1 },
      }),
    );
  } catch {
    /* best-effort — the worst case is a duplicate reminder next run */
  }
}

export const firstNameFromEmail = (email: string): string => {
  const token = (email.split("@")[0] ?? "").split(/[._-]/)[0] ?? "";
  return token ? token.charAt(0).toUpperCase() + token.slice(1) : "there";
};

export type RemindResult = { pending: number; reminded: number; skipped: number; remaining: number };

// Send a branded reminder to up to `limit` pending invitees not reminded within
// `minHoursSinceReminder`. Returns counts so the caller can prompt "click again".
export async function remindPendingInvites(opts?: { limit?: number; minHoursSinceReminder?: number }): Promise<RemindResult> {
  const limit = opts?.limit ?? 40;
  const minHours = opts?.minHoursSinceReminder ?? 48;
  if (!clerkEnabled || !sesEnabled) return { pending: 0, reminded: 0, skipped: 0, remaining: 0 };

  const pending = await listPendingInvites();
  let reminded = 0;
  let skipped = 0;
  let processed = 0;
  for (const inv of pending) {
    if (reminded >= limit) break;
    processed++;
    if (await recentlyReminded(inv.email, minHours)) {
      skipped++;
      continue;
    }
    const acceptUrl = inv.url || `${SITE_URL}/sign-in`;
    const email = inviteReminder({ firstName: firstNameFromEmail(inv.email), acceptUrl });
    const res = await sendEmail({ to: inv.email, subject: email.subject, html: email.html, text: email.text });
    if (res.sent) {
      await markReminded(inv.email);
      reminded++;
    } else {
      skipped++;
    }
  }
  return { pending: pending.length, reminded, skipped, remaining: Math.max(0, pending.length - processed) };
}

export type ResendReason = "not_pending" | "not_configured" | "send_failed";

// Resend the branded invitation reminder to ONE still-pending invitee. Unlike the
// bulk `remindPendingInvites`, this is an explicit per-person admin action, so it
// deliberately bypasses the 48h de-dup guard — but it still refuses to email anyone
// who has already accepted (not in Clerk's pending list). The send is recorded in
// the reminder ledger so the bulk job won't double-nudge them right after.
export async function resendInvite(email: string): Promise<{ ok: boolean; reason?: ResendReason }> {
  const target = email.trim().toLowerCase();
  if (!clerkEnabled || !sesEnabled) return { ok: false, reason: "not_configured" };

  const pending = await listPendingInvites();
  const invite = pending.find((p) => p.email === target);
  if (!invite) return { ok: false, reason: "not_pending" };

  const acceptUrl = invite.url || `${SITE_URL}/sign-in`;
  const mail = inviteReminder({ firstName: firstNameFromEmail(target), acceptUrl });
  const res = await sendEmail({ to: target, subject: mail.subject, html: mail.html, text: mail.text });
  if (!res.sent) return { ok: false, reason: "send_failed" };

  await markReminded(target);
  return { ok: true };
}
