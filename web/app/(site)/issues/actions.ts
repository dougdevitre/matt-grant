"use server";

import { headers } from "next/headers";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { volunteerWelcome } from "@/lib/email/templates";
import { CAMPAIGN } from "@/lib/site";
import { toE164 } from "@/lib/sms/send";
import { recordConsent } from "@/lib/sms/consent";
import { createSubmission, issueBoardConfigured } from "@/lib/issue-board/airtable";
import { notifyModeratorsNewIssue, notifyCaptainsNewVolunteer } from "@/lib/notifications/staffNotify";

export type CommitResult = { ok: boolean; message: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A supporter commits to a specific issue + how they'll help. Captured as a
// volunteer lead tagged with the issue (shows in the dashboard CRM; an admin/
// captain can then mobilize that segment via the "issues" email topic), and sent
// the branded welcome. Best-effort email; never blocks the commitment.
export async function commitToIssue(_prev: CommitResult | null, formData: FormData): Promise<CommitResult> {
  // Honeypot: bots fill this hidden field.
  if (String(formData.get("company") ?? "").trim()) return { ok: true, message: "You're in — thank you." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const issueLabel = String(formData.get("issueLabel") ?? "this issue").trim();
  const ways = formData.getAll("ways").map(String).filter(Boolean);

  if (!name || !email) return { ok: false, message: "Add your name and email so the campaign can follow up." };
  if (!email.includes("@")) return { ok: false, message: "Please enter a valid email address." };
  if (!dbConfigured) {
    return { ok: false, message: "Our intake isn't connected yet — email mattgrantforcongress@gmail.com and we'll follow up." };
  }

  // Rate-limit per client IP so this public form can't be used to spam leads or
  // fan out welcome emails. Fails open (lib/ratelimit) — a DynamoDB blip never
  // blocks a real supporter.
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const rl = await rateLimit(`issue-commit:${ip}`, { limit: 10, windowSec: 3600 });
  if (!rl.allowed) {
    return { ok: false, message: "Too many submissions from this connection — please try again in a little while." };
  }

  const interests = `${issueLabel}${ways.length ? " — " + ways.join(", ") : ""}`;
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: PK.volunteers,
          SK: newId(),
          name,
          email,
          interests,
          notes: `Committed on the “${issueLabel}” issue page.`,
          status: "NEW",
          source: "issue-commit",
          createdAt: new Date().toISOString(),
        },
      }),
    );
  } catch {
    return { ok: false, message: "Something went wrong saving your commitment. Please try again." };
  }

  if (sesEnabled && email) {
    try {
      const tpl = volunteerWelcome(esc(name.split(" ")[0] || "there"));
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    } catch {
      /* lead saved even if the welcome email fails */
    }
  }
  // Alert captains to follow up with the new volunteer (best-effort).
  await notifyCaptainsNewVolunteer({ name, email, interests });

  return { ok: true, message: `You're in — thank you for standing with Matt on ${issueLabel}.` };
}

export type TopicResult = { ok: boolean; message: string };

// A supporter submits a topic that matters to them. It lands in the "Matt Grant
// for Congress - Issues" Airtable base as Status="Pending" — NOTHING is public
// until a human approves it inside Airtable, so the board can't be defaced. As a
// side benefit of the full-intake form, a contactable volunteer lead is recorded
// (best-effort) and SMS consent is captured only on explicit opt-in (TCPA). The
// Airtable write is the only thing that can fail the form; everything else is
// best-effort and never blocks a real submission.
export async function submitTopic(_prev: TopicResult | null, formData: FormData): Promise<TopicResult> {
  // Honeypot: bots fill this hidden field. Pretend success so they don't retry.
  if (String(formData.get("company") ?? "").trim()) {
    return { ok: true, message: "Thank you — your topic was submitted for review." };
  }

  const topic = String(formData.get("topic") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  // Cap the optional metadata fields server-side. The form's maxLength is
  // client-only and trivially bypassed by POSTing the action directly, so without
  // this a bot could shove multi-MB strings into Airtable + the moderation email.
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const city = String(formData.get("city") ?? "").trim().slice(0, 100);
  const email = String(formData.get("email") ?? "").trim().slice(0, 254);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40);
  const smsOptIn = !!String(formData.get("smsOptIn") ?? "").trim();

  if (!topic) return { ok: false, message: "Add a short topic so we know what matters to you." };
  if (topic.length > 140) return { ok: false, message: "Please keep the topic under 140 characters." };
  if (!details) return { ok: false, message: "Tell us a little about why this matters to you." };
  if (details.length > 2000) return { ok: false, message: "Please keep your note under 2,000 characters." };
  // Email is optional; if given, require a real-ish shape (one @, a dotted domain).
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (email && !emailValid) return { ok: false, message: "Please enter a valid email address." };

  if (!(await issueBoardConfigured())) {
    return { ok: false, message: "Our submission board isn't connected yet — email mattgrantforcongress@gmail.com and we'll add your topic." };
  }

  // Rate-limit per client IP before the write so the public board can't be flooded.
  // Fails open (lib/ratelimit) so an infra blip never blocks a real supporter.
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const rl = await rateLimit(`issue-topic:${ip}`, { limit: 5, windowSec: 3600 });
  if (!rl.allowed) {
    return { ok: false, message: "Too many submissions from this connection — please try again in a little while." };
  }

  try {
    await createSubmission({ topic, details, name, city, email, phone, smsOptIn });
  } catch (err) {
    // Surface the real cause server-side (e.g. a renamed Airtable field → 422)
    // so a silent moderation outage is debuggable; the supporter sees a friendly
    // message, never the internals.
    console.error("[issue submit] Airtable write failed:", err);
    return { ok: false, message: "Something went wrong submitting your topic. Please try again, or email mattgrantforcongress@gmail.com." };
  }

  // Full-intake side effects — all best-effort, none can fail the submission.
  // 1) Contactable volunteer lead in the CRM, tagged so it's clear where it came from.
  if (dbConfigured && (email || phone)) {
    try {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            PK: PK.volunteers,
            SK: newId(),
            name: name || "Topic submitter",
            email: email || null,
            phone: phone || null,
            city: city || null,
            interests: "Issues board",
            notes: `Submitted topic: “${topic}”`,
            status: "NEW",
            source: "issue-topic",
            createdAt: new Date().toISOString(),
          },
        }),
      );
    } catch {
      /* topic is already safely in Airtable */
    }
  }
  // 2) SMS consent (TCPA) — only when explicitly opted in AND the phone is valid.
  if (smsOptIn) {
    const e164 = toE164(phone);
    if (e164) {
      try {
        await recordConsent(e164, "issue-topic");
      } catch {
        /* best-effort */
      }
    }
  }
  // 3) Heads-up to the campaign inbox so a human knows to moderate in Airtable.
  if (sesEnabled) {
    try {
      await sendEmail({
        // Only set replyTo from a validated address; strip CR/LF from the subject
        // so a topic can't inject extra email headers.
        to: CAMPAIGN.email,
        replyTo: emailValid ? email : undefined,
        subject: `New issue topic to review: ${topic.replace(/[\r\n]+/g, " ").slice(0, 80)}`,
        html: `<p><strong>${esc(topic)}</strong></p><p>${esc(details).replace(/\n/g, "<br>")}</p><p>From: ${esc(name) || "—"}${city ? `, ${esc(city)}` : ""}<br>Email: ${esc(email) || "—"} · Phone: ${esc(phone) || "—"}</p><p>Approve or reject it in the Issues Airtable base.</p>`,
        text: `${topic}\n\n${details}\n\nFrom: ${name || "—"}${city ? `, ${city}` : ""}\nEmail: ${email || "—"} · Phone: ${phone || "—"}\n\nApprove or reject it in the Issues Airtable base.`,
      });
    } catch {
      /* best-effort */
    }
  }
  // 4) Alert the moderators (admins + captains) by role so the queue gets worked (best-effort).
  await notifyModeratorsNewIssue({ topic, name, city });

  return { ok: true, message: "Thank you — your topic was submitted for review. We read every one before it's posted." };
}
