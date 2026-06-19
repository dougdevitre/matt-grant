"use server";

import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { volunteerWelcome, contactReceipt } from "@/lib/email/templates";
import { CAMPAIGN } from "@/lib/site";

export type ContactResult = { ok: boolean; message: string };

// Escape user input before it goes into an HTML email body. Without this, a
// submitter could inject markup / phishing links into the notification email the
// campaign receives. (The submitter's first name flows into the branded receipt
// templates too, so it's escaped at the boundary before being passed in.)
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Fire the branded receipt to the submitter + a plain notification to the
// campaign inbox. Best-effort: never fail the form if email is down/unconfigured.
async function notify(p: { name: string; email: string; phone: string; city: string; interests: string; message: string }) {
  if (!sesEnabled) return;
  try {
    const wantsVolunteer = /knock|call|host|sign|other/i.test(p.interests);
    if (p.email) {
      const firstName = esc(p.name.split(" ")[0] || "there");
      const tpl = wantsVolunteer ? volunteerWelcome(firstName) : contactReceipt(firstName);
      await sendEmail({ to: p.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    }
    await sendEmail({
      to: CAMPAIGN.email,
      replyTo: p.email || undefined,
      subject: `New supporter: ${p.name}${p.city ? ` (${p.city})` : ""}`,
      html: `<p><strong>${esc(p.name)}</strong></p><p>Email: ${esc(p.email) || "—"}<br>Phone: ${esc(p.phone) || "—"}<br>City: ${esc(p.city) || "—"}<br>Interests: ${esc(p.interests) || "—"}</p><p>${esc(p.message).replace(/\n/g, "<br>")}</p>`,
      text: `${p.name}\nEmail: ${p.email}\nPhone: ${p.phone}\nCity: ${p.city}\nInterests: ${p.interests}\n\n${p.message}`,
    });
  } catch {
    /* swallow — the lead is already saved to the DB */
  }
}

export async function submitContact(_prev: ContactResult | null, formData: FormData): Promise<ContactResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const interests = formData.getAll("interests").map(String).join(", ");
  const message = String(formData.get("message") ?? "").trim();

  // Honeypot: a hidden field real users never see or fill. If it has a value,
  // it's almost certainly a bot — return a success message without saving or
  // emailing, so the bot doesn't learn it was filtered.
  if (String(formData.get("company") ?? "").trim()) {
    return { ok: true, message: "Thank you! The campaign will be in touch soon. Onward to August 4." };
  }

  if (!name || (!email && !phone)) {
    return { ok: false, message: "Please add your name and an email or phone so we can reach you." };
  }

  if (!dbConfigured) {
    return {
      ok: false,
      message: "Our intake isn't connected yet. Please email mattgrantforcongress@gmail.com and we'll follow up.",
    };
  }

  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: PK.volunteers,
          SK: newId(),
          name,
          email: email || undefined,
          phone: phone || undefined,
          city: city || undefined,
          interests: interests || undefined,
          notes: message || undefined,
          status: "NEW",
          createdAt: new Date().toISOString(),
        },
      }),
    );
    await notify({ name, email, phone, city, interests, message });
    return { ok: true, message: "Thank you! The campaign will be in touch soon. Onward to August 4." };
  } catch {
    return {
      ok: false,
      message: "Something went wrong saving your info. Please email mattgrantforcongress@gmail.com.",
    };
  }
}
