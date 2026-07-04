"use server";

import { headers } from "next/headers";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { rateLimit, clientIpFromHeaders } from "@/lib/ratelimit";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { volunteerWelcome, contactReceipt } from "@/lib/email/templates";
import { CAMPAIGN } from "@/lib/site";
import { toE164 } from "@/lib/sms/send";
import { recordConsent } from "@/lib/sms/consent";
import { saveProfile, cleanZip } from "@/lib/profile";
import { notifyCaptainsNewVolunteer } from "@/lib/notifications/staffNotify";
import { mirrorVolunteerToAirtable } from "@/lib/volunteers/airtable";

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
    // If they signed up to actively help, alert captains by role to follow up.
    if (wantsVolunteer) await notifyCaptainsNewVolunteer({ name: p.name, email: p.email, interests: p.interests });
  } catch {
    /* swallow — the lead is already saved to the DB */
  }
}

export async function submitContact(_prev: ContactResult | null, formData: FormData): Promise<ContactResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const interestTags = formData.getAll("interests").map(String).filter(Boolean);
  const interests = interestTags.join(", ");
  const message = String(formData.get("message") ?? "").trim();
  const smsOptIn = !!String(formData.get("smsOptIn") ?? "").trim();
  const zip = cleanZip(String(formData.get("zip") ?? ""));

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

  // Rate-limit per client IP before the DB write so the public intake can't be
  // flooded with junk leads. Fails open (see lib/ratelimit) so a DynamoDB hiccup
  // never blocks a real supporter. Honeypot + validation already ran above, so
  // only real-looking submissions count against the window.
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  const rl = await rateLimit(`contact:${ip}`, { limit: 10, windowSec: 3600 });
  if (!rl.allowed) {
    return { ok: false, message: "Too many submissions from this connection — please try again in a little while." };
  }

  const source = String(formData.get("source") ?? "").trim() || "contact-form";
  // Dedupe by a stable key so re-submitting the same email/phone updates the
  // existing lead instead of spawning a duplicate card. Random id only when
  // neither is given.
  const dedupeKey = email
    ? `e:${email.toLowerCase()}`
    : phone
      ? `p:${phone.replace(/\D/g, "")}`
      : newId();
  const now = new Date().toISOString();
  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.volunteers, SK: dedupeKey },
        ReturnValues: "ALL_NEW",
        // Latest submission wins for contact details; status + createdAt are set
        // once and never reset — an ACTIVE volunteer who re-submits stays ACTIVE.
        UpdateExpression:
          "SET #n = :n, email = :em, phone = :ph, city = :ci, zip = :zip, interests = :in, interestTags = :tags, notes = :no, " +
          "#src = :src, updatedAt = :u, #st = if_not_exists(#st, :new), createdAt = if_not_exists(createdAt, :u)",
        ExpressionAttributeNames: { "#n": "name", "#st": "status", "#src": "source" },
        ExpressionAttributeValues: {
          ":n": name,
          ":em": email || null,
          ":ph": phone || null,
          ":ci": city || null,
          ":zip": zip ?? null,
          ":tags": interestTags,
          ":in": interests || null,
          ":no": message || null,
          ":src": source,
          ":u": now,
          ":new": "NEW",
        },
      }),
    );
    // Explicit SMS opt-in (TCPA): record consent only when the box was checked
    // and the phone normalizes to a valid US number. Best-effort — never fail the
    // form on it, and never opt in a number that wasn't explicitly consented.
    if (smsOptIn) {
      const e164 = toE164(phone);
      if (e164) {
        try {
          await recordConsent(e164, "web-form");
        } catch {
          /* best-effort */
        }
      }
    }
    // Save zip to the reusable supporter profile (only when we have an email to
    // key on and an actual zip — avoids creating empty profile rows). Best-effort.
    if (email && zip) {
      try {
        await saveProfile(email, { zip });
      } catch {
        /* best-effort */
      }
    }
    // Mirror the lead into the Airtable Volunteers roster so contact-form signups
    // appear there too (not just /join). Door "Get Updates" (the neutral floor);
    // upsert on the stored Airtable id to avoid duplicate rows. Best-effort.
    const existingAirtableId = (res.Attributes?.airtableId as string) ?? null;
    const mirrorMessage = [interests ? `Interested in: ${interests}` : "", message].filter(Boolean).join("\n\n");
    const mirroredId = await mirrorVolunteerToAirtable(
      {
        name,
        email,
        phone,
        city,
        zip,
        door: "Get Updates",
        smsOptIn,
        message: mirrorMessage || undefined,
        source,
        signedUpDate: now.slice(0, 10),
      },
      existingAirtableId,
    ).catch(() => null);
    if (mirroredId && mirroredId !== existingAirtableId) {
      await ddb
        .send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { PK: PK.volunteers, SK: dedupeKey },
            UpdateExpression: "SET airtableId = :aid",
            ExpressionAttributeValues: { ":aid": mirroredId },
          }),
        )
        .catch(() => {});
    }
    await notify({ name, email, phone, city, interests, message });
    return { ok: true, message: "Thank you! The campaign will be in touch soon. Onward to August 4." };
  } catch {
    return {
      ok: false,
      message: "Something went wrong saving your info. Please email mattgrantforcongress@gmail.com.",
    };
  }
}
