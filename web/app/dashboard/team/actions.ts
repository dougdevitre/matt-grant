"use server";

import { revalidatePath } from "next/cache";
import { addStaff, removeStaff, setStaffRole } from "@/lib/staff";
import { staffGate } from "@/lib/auth";
import { can, asRole } from "@/lib/rbac";
import { setClerkRoleByEmail } from "@/lib/clerkRoles";
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
  const role = asRole(formData.get("role")) ?? "organizer";
  if (!email || !email.includes("@")) return { ok: false, message: "Enter a valid email address." };

  try {
    await addStaff(email, name || undefined, role, inviter || undefined);
    await setClerkRoleByEmail(email, role); // immediate if they already have an account
  } catch {
    return { ok: false, message: "Couldn't save the invite. Check the database connection." };
  }

  if (sesEnabled) {
    try {
      const html = renderEmail({
        eyebrow: "Campaign HQ",
        title: "You're on the team.",
        bodyHtml: `<p>You've been invited to the Matt Grant for Congress <strong>War Room</strong> — the campaign's private command center.</p>
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

  revalidatePath("/dashboard/team");
  return { ok: true, message: sesEnabled ? `Invited ${email} — an email is on the way.` : `Added ${email}. (Email sending isn't configured yet.)` };
}

export async function revokeStaff(formData: FormData): Promise<void> {
  await guardAdmin();
  const email = String(formData.get("email") ?? "");
  if (email) {
    await removeStaff(email);
    revalidatePath("/dashboard/team");
  }
}

// Change an invited member's role (DynamoDB + Clerk metadata write-through).
export async function setMemberRole(formData: FormData): Promise<void> {
  await guardAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = asRole(formData.get("role"));
  if (email && role) {
    await setStaffRole(email, role);
    await setClerkRoleByEmail(email, role);
    revalidatePath("/dashboard/team");
  }
}
