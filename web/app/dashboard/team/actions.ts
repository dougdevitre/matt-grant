"use server";

import { revalidatePath } from "next/cache";
import { addStaff, removeStaff, setStaffRole, staffRole } from "@/lib/staff";
import { staffGate } from "@/lib/auth";
import { can, asRole, INVITABLE_ROLES, ROLE_LABELS } from "@/lib/rbac";
import { setClerkRoleByEmail, inviteToClerk, clearClerkRoleByEmail } from "@/lib/clerkRoles";
import { recordAccessChange } from "@/lib/audit";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { renderEmail, renderText } from "@/lib/email/layout";
import { SITE_URL } from "@/lib/site";
import { remindPendingInvites, resendInvite } from "@/lib/invites";
import { sendRoleWelcome } from "@/lib/notifications/staffNotify";
import { looksExternal } from "@/lib/externalEmail";

export type InviteResult = { ok: boolean; message: string };

// Send a branded reminder to a bounded batch of still-pending Clerk invitees.
// Safe to click repeatedly: de-duped (won't re-remind within 48h) and bounded so
// one click stays under the function timeout. Admin-only.
export async function remindPendingInvitesAction(_prev: InviteResult | null): Promise<InviteResult> {
  await guardAdmin();
  if (!sesEnabled) return { ok: false, message: "Email isn't configured yet (set SES_FROM)." };
  const r = await remindPendingInvites({ limit: 40, minHoursSinceReminder: 48 });
  revalidatePath("/dashboard/team");
  if (r.pending === 0) return { ok: true, message: "No pending invitations to remind." };
  const skipped = r.skipped ? ` · skipped ${r.skipped} (recently reminded)` : "";
  const tail = r.remaining > 0 ? ` · ${r.remaining} left — click again to send the rest.` : "";
  return { ok: true, message: `Reminded ${r.reminded} pending invitee${r.reminded === 1 ? "" : "s"}${skipped}${tail}` };
}

// Resend the invitation to ONE still-pending person from their row's button.
// Explicit per-person nudge: bypasses the 48h de-dup, refuses anyone who already
// accepted, and logs an `invite_reminder` audit entry. Admin-only.
export async function resendInviteAction(_prev: InviteResult | null, formData: FormData): Promise<InviteResult> {
  const actor = await guardAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, message: "No email to resend to." };
  if (!sesEnabled) return { ok: false, message: "Email isn't configured yet (set SES_FROM)." };

  const r = await resendInvite(email);
  if (!r.ok) {
    const message =
      r.reason === "not_pending"
        ? `${email} has already accepted — no email sent.`
        : r.reason === "not_configured"
          ? "Email or Clerk isn't configured yet."
          : `Couldn't send the reminder to ${email}. Try again.`;
    return { ok: false, message };
  }

  await recordAccessChange({ at: new Date().toISOString(), actor: actor || "system", target: email, action: "invite_reminder" });
  revalidatePath("/dashboard/team");
  return { ok: true, message: `Reminder sent to ${email}.` };
}

// Only those with the manageTeam capability (admins) may manage access.
async function guardAdmin(): Promise<string | null> {
  const g = await staffGate();
  if (!g.ok || !can(g.role, "manageTeam")) throw new Error("Forbidden");
  return g.email;
}

export async function inviteStaff(_prev: InviteResult | null, formData: FormData): Promise<InviteResult> {
  const inviter = await guardAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  // Staff picker may only assign internal roles — `partner` is provisioned via
  // the Peace Room invite flow, never here, so it can't be granted by accident.
  const requested = asRole(formData.get("role"));
  const role = requested && INVITABLE_ROLES.includes(requested) ? requested : "volunteer";
  if (!email || !email.includes("@")) return { ok: false, message: "Enter a valid email address." };

  // A STAFF invite grants internal dashboard access once that email signs up. Press,
  // government, and org role-inboxes get invited here by mistake (an admin treating
  // the form like a contact list), so require an explicit confirmation for those.
  const ext = looksExternal(email);
  if (ext && formData.get("confirmExternal") !== "on") {
    const why = ext === "gov/mil" ? "a government/military address" : ext === "press/org" ? "a press/org address" : "a role inbox, not a person";
    return { ok: false, message: `${email} looks like ${why}. Inviting grants internal dashboard access at the ${ROLE_LABELS[role]} role. If that's intended, check the confirmation box and re-send.` };
  }

  let clerk = { invited: false, existing: false };
  try {
    await addStaff(email, name || undefined, role, inviter || undefined);
    clerk = await inviteToClerk(email, role); // Clerk invitation — works under restricted sign-up
  } catch {
    return { ok: false, message: "Couldn't save the invite. Check the database connection." };
  }

  // Clerk emails brand-new invitees its own invitation link. Only send our SES
  // note when Clerk didn't (no Clerk keys, or the person already has an account).
  if (!clerk.invited && sesEnabled) {
    try {
      const html = renderEmail({
        eyebrow: "Campaign HQ",
        title: "You're on the team.",
        bodyHtml: `<p>You've been invited to the Matt Grant for Congress <strong>Peace Room</strong> — the campaign's collaborative hub, where the team works together to restore public trust in MO-02.</p>
          <p>Sign in with <strong>${email}</strong> to get started.</p>`,
        button: { label: "Sign in to HQ", href: `${SITE_URL}/sign-in`, color: "red" },
      });
      await sendEmail({
        to: email,
        subject: "You're invited to the Matt Grant campaign HQ",
        html,
        text: renderText({ title: "You're on the team", lines: [`Sign in with ${email}: ${SITE_URL}/sign-in`] }),
      });
    } catch {
      /* invite saved even if the email fails */
    }
  }

  await recordAccessChange({ at: new Date().toISOString(), actor: inviter || "system", target: email, action: "invite", role });
  revalidatePath("/dashboard/team");
  const message = clerk.invited
    ? `Invited ${email} — Clerk emailed them an invitation to join.`
    : clerk.existing
      ? `Updated ${email}'s access — they can sign in now.`
      : sesEnabled
        ? `Invited ${email} — an email is on the way.`
        : `Added ${email}. (Connect Clerk to email invitations.)`;
  return { ok: true, message };
}

// Provision a coalition PARTNER — the Peace Room invite flow. Kept separate from
// inviteStaff so the role is hard-coded to "partner" (never picked from a form)
// and the email uses collaborative, Peace-Room-only copy. Admin-gated like the
// rest of access management.
export async function invitePartner(_prev: InviteResult | null, formData: FormData): Promise<InviteResult> {
  const inviter = await guardAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!email || !email.includes("@")) return { ok: false, message: "Enter a valid email address." };

  let clerk = { invited: false, existing: false };
  try {
    await addStaff(email, name || undefined, "partner", inviter || undefined);
    clerk = await inviteToClerk(email, "partner");
  } catch {
    return { ok: false, message: "Couldn't save the invite. Check the database connection." };
  }

  if (!clerk.invited && sesEnabled) {
    try {
      const html = renderEmail({
        eyebrow: "Peace Room",
        title: "Join the coalition.",
        bodyHtml: `<p>You're invited to the Matt Grant for Congress <strong>Peace Room</strong> — the shared space where allied candidates and coalition partners make one case together: the data shows it's time for a change in MO-02.</p>
          <p>You'll see the shared case for change and nothing else — this is a collaboration space, not the campaign's internal tools.</p>
          <p>Sign in with <strong>${email}</strong> to join.</p>`,
        button: { label: "Enter the Peace Room", href: `${SITE_URL}/sign-in`, color: "red" },
      });
      await sendEmail({
        to: email,
        subject: "You're invited to the Matt Grant Peace Room",
        html,
        text: renderText({ title: "Join the coalition", lines: [`Sign in with ${email}: ${SITE_URL}/sign-in`] }),
      });
    } catch {
      /* invite saved even if the email fails */
    }
  }

  await recordAccessChange({ at: new Date().toISOString(), actor: inviter || "system", target: email, action: "invite", role: "partner" });
  revalidatePath("/dashboard/team");
  const message = clerk.invited
    ? `Invited ${email} to the Peace Room — Clerk emailed them.`
    : clerk.existing
      ? `${email} can now enter the Peace Room.`
      : sesEnabled
        ? `Invited ${email} to the Peace Room — an email is on the way.`
        : `Added ${email} as a partner. (Connect Clerk to email invitations.)`;
  return { ok: true, message };
}

export async function revokeStaff(formData: FormData): Promise<void> {
  const actor = await guardAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email) {
    await removeStaff(email); // mark the DynamoDB row removed (fallback layer)
    await clearClerkRoleByEmail(email); // demote in Clerk + end live sessions (runtime layer)
    await recordAccessChange({ at: new Date().toISOString(), actor: actor || "system", target: email, action: "revoke" });
    revalidatePath("/dashboard/team");
  }
}

// Change an invited member's role (DynamoDB + Clerk metadata write-through).
export async function setMemberRole(formData: FormData): Promise<void> {
  const actor = await guardAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // Staff role-change may only move someone between internal roles. It cannot
  // turn a staffer into a `partner` or a partner into staff — partners are
  // managed via the Peace Room invite/revoke flow, keeping the wall one-way.
  const role = asRole(formData.get("role"));
  if (email && role && INVITABLE_ROLES.includes(role)) {
    const prevRole = (await staffRole(email)) ?? undefined;
    await setStaffRole(email, role);
    await setClerkRoleByEmail(email, role);
    if (prevRole !== role) {
      await recordAccessChange({ at: new Date().toISOString(), actor: actor || "system", target: email, action: "role_change", role, prevRole });
      // Email the staffer their new role-specific "here's your access" welcome (best-effort).
      await sendRoleWelcome(email, role);
    }
    revalidatePath("/dashboard/team");
  }
}
