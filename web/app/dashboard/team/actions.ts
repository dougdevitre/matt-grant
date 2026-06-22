"use server";

import { revalidatePath } from "next/cache";
import { addStaff, removeStaff, setStaffRole, staffRole } from "@/lib/staff";
import { staffGate } from "@/lib/auth";
import { can, asRole, INVITABLE_ROLES } from "@/lib/rbac";
import { setClerkRoleByEmail, inviteToClerk } from "@/lib/clerkRoles";
import { recordAccessChange } from "@/lib/audit";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { renderEmail, renderText } from "@/lib/email/layout";
import { SITE_URL } from "@/lib/site";

export type InviteResult = { ok: boolean; message: string };

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
  const role = requested && INVITABLE_ROLES.includes(requested) ? requested : "member";
  if (!email || !email.includes("@")) return { ok: false, message: "Enter a valid email address." };

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

export async function revokeStaff(formData: FormData): Promise<void> {
  const actor = await guardAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email) {
    await removeStaff(email);
    await recordAccessChange({ at: new Date().toISOString(), actor: actor || "system", target: email, action: "revoke" });
    revalidatePath("/dashboard/team");
  }
}

// Change an invited member's role (DynamoDB + Clerk metadata write-through).
export async function setMemberRole(formData: FormData): Promise<void> {
  const actor = await guardAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = asRole(formData.get("role"));
  if (email && role) {
    const prevRole = (await staffRole(email)) ?? undefined;
    await setStaffRole(email, role);
    await setClerkRoleByEmail(email, role);
    if (prevRole !== role) {
      await recordAccessChange({ at: new Date().toISOString(), actor: actor || "system", target: email, action: "role_change", role, prevRole });
    }
    revalidatePath("/dashboard/team");
  }
}
