"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { addSignup, getEvent, isEventFull, type EventRow } from "@/lib/events";
import { formatEventRange } from "@/lib/events/time";
import { rateLimit, clientIpFromHeaders } from "@/lib/ratelimit";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { renderEmail, renderText } from "@/lib/email/layout";
import { SITE_URL, CAMPAIGN } from "@/lib/site";

export type RsvpState = { ok: boolean; message: string };

const goingCount = (e: EventRow) => e.signups.reduce((s, x) => s + (Number(x.count) || 1), 0);

// Best-effort RSVP confirmation. Never throws — a mail failure must not fail the
// RSVP (mirrors registerTexter's SES fallback). Includes an add-to-calendar link.
async function sendRsvpConfirmation(event: EventRow, to: string): Promise<void> {
  if (!to || !sesEnabled) return;
  const when = formatEventRange(event.start, event.end);
  const where = [event.location.name, event.location.city].filter(Boolean).join(", ") || "MO-02";
  const icsUrl = `${SITE_URL}/api/events/${event.id}/calendar.ics`;
  try {
    await sendEmail({
      to,
      subject: `You're signed up: ${event.title}`,
      html: renderEmail({
        eyebrow: "Matt Grant for Congress",
        title: "You're signed up — thank you!",
        bodyHtml: `<p>Thanks for signing up for <strong>${event.title}</strong>.</p><p><strong>When:</strong> ${when}<br/><strong>Where:</strong> ${where}</p><p>We'll be in touch with any details. See you there!</p>`,
        button: { label: "Add to your calendar", href: icsUrl, color: "red" },
      }),
      text: renderText({
        title: "You're signed up — thank you!",
        lines: [`${event.title}`, `When: ${when}`, `Where: ${where}`, `Add to calendar: ${icsUrl}`, CAMPAIGN.paidForBy],
      }),
    });
  } catch {
    /* RSVP is recorded even if the confirmation email fails */
  }
}

// Public RSVP — no auth. Rate-limited per IP so the embedded sign-up list can't be
// spammed. Appends to the event's signups[]; PII stays staff-only (the public page
// shows just a count).
export async function rsvp(formData: FormData): Promise<RsvpState> {
  const id = String(formData.get("eventId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return { ok: false, message: "Please enter your name." };

  const h = await headers();
  const ip = clientIpFromHeaders(h);
  const rl = await rateLimit(`rsvp:${ip}`, { limit: 12, windowSec: 3600 });
  if (!rl.allowed) return { ok: false, message: "Too many sign-ups from this connection — try again later." };

  const event = await getEvent(id);
  if (!event || event.status !== "PUBLISHED") return { ok: false, message: "This event isn't open for sign-ups." };
  if (isEventFull(event.capacity, goingCount(event))) {
    return { ok: false, message: "This event is at capacity — thanks for your interest!" };
  }

  const email = String(formData.get("email") ?? "").trim() || undefined;
  const ok = await addSignup(id, {
    name,
    email,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    role: String(formData.get("role") ?? "").trim() || undefined,
    count: Number(formData.get("count") ?? 1) || 1,
  });
  if (!ok) return { ok: false, message: "Something went wrong — please try again." };

  if (email) await sendRsvpConfirmation(event, email);

  revalidatePath(`/events/${id}`);
  revalidatePath(`/dashboard/events/${id}`);
  return {
    ok: true,
    message: email
      ? "You're in — thanks! Check your email for the details and a calendar link."
      : "You're in — thanks! We'll be in touch with details.",
  };
}
