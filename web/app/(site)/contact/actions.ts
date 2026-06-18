"use server";

import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { volunteerWelcome, contactReceipt } from "@/lib/email/templates";
import { CAMPAIGN } from "@/lib/site";

export type ContactResult = { ok: boolean; message: string };

// Fire the branded receipt to the submitter + a plain notification to the
// campaign inbox. Best-effort: never fail the form if email is down/unconfigured.
async function notify(p: { name: string; email: string; phone: string; city: string; interests: string; message: string }) {
  if (!sesEnabled) return;
  try {
    const wantsVolunteer = /knock|call|host|sign|other/i.test(p.interests);
    if (p.email) {
      const tpl = wantsVolunteer ? volunteerWelcome(p.name.split(" ")[0]) : contactReceipt(p.name.split(" ")[0]);
      await sendEmail({ to: p.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    }
    await sendEmail({
      to: CAMPAIGN.email,
      replyTo: p.email || undefined,
      subject: `New supporter: ${p.name}${p.city ? ` (${p.city})` : ""}`,
      html: `<p><strong>${p.name}</strong></p><p>Email: ${p.email || "—"}<br>Phone: ${p.phone || "—"}<br>City: ${p.city || "—"}<br>Interests: ${p.interests || "—"}</p><p>${p.message || ""}</p>`,
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
