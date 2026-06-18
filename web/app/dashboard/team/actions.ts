"use server";

import { revalidatePath } from "next/cache";
import { addStaff, removeStaff } from "@/lib/staff";
import { staffGate } from "@/lib/auth";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { renderEmail, renderText } from "@/lib/email/layout";
import { SITE_URL } from "@/lib/site";

export type InviteResult = { ok: boolean; message: string };

// Only admins may manage team access.
async function guardAdmin(): Promise<string | null> {
  const g = await staffGate();
  if (!g.ok || g.role !== "admin") throw new Error("Forbidden");
  return g.email;
}

export async function inviteStaff(_prev: InviteResult | null, formData: FormData): Promise<InviteResult> {
  const inviter = await guardAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "organizer") === "admin" ? "admin" : "organizer";
  if (!email || !email.includes("@")) return { ok: false, message: "Enter a valid email address." };

  try {
    await addStaff(email, name || undefined, role, inviter || undefined);
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
