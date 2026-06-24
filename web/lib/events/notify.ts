// Fire the existing email + SMS broadcast systems when an event is published.
// Reuses the unused "event" email template (lib/email/broadcasts.ts) and the SMS
// campaign queue. Idempotent per channel via claimNotify() — a re-publish or a
// double-click cannot double-queue. Best-effort: a notification failure never
// rolls back the publish (the caller already flipped status to PUBLISHED).
import { resolveRecipients } from "@/lib/email/audiences";
import { createCampaign } from "@/lib/campaigns";
import { resolveSmsRecipients } from "@/lib/sms/audiences";
import { createSmsCampaign } from "@/lib/sms/campaigns";
import { withCompliance } from "@/lib/sms/templates";
import { SITE_URL } from "@/lib/site";
import { claimNotify, type EventRow, EVENT_TYPE_LABELS } from "@/lib/events";

// Human date/time in Central (the campaign's timezone). "Sat, Jul 12 · 6:00 PM".
export function formatEventDate(startIso: string): string {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return startIso;
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", hour: "numeric", minute: "2-digit",
  }).format(d);
  return `${day} · ${time}`;
}

export type NotifyResult = { email: { queued: boolean; reason?: string }; sms: { queued: boolean; reason?: string } };

export async function publishEventNotifications(event: EventRow, by: string): Promise<NotifyResult> {
  const out: NotifyResult = { email: { queued: false }, sms: { queued: false } };
  const when = formatEventDate(event.start);
  const locline = [event.location.name, event.location.city].filter(Boolean).join(", ");
  const rsvpUrl = `${SITE_URL}/events/${event.id}`;

  // ── Email → captains + volunteers (reuses the "event" broadcast template) ──
  try {
    if (await claimNotify(event.id, "Email")) {
      const { recipients, internal } = await resolveRecipients(["captains", "volunteers"]);
      if (recipients.length) {
        await createCampaign({
          templateKey: "event",
          topic: "events",
          vars: {
            event_title: event.title,
            event_date: when,
            event_location: locline || event.location.name || "MO-02",
            event_details: event.description || `Join ${EVENT_TYPE_LABELS[event.type]}.`,
            rsvp_url: rsvpUrl,
            calendar_url: `${SITE_URL}/api/events/${event.id}/calendar.ics`,
          },
          audience: "Captains + Volunteers",
          recipients,
          subjectPreview: `Join us: ${event.title}`,
          createdBy: by,
          internal,
        });
        out.email.queued = true;
      } else {
        out.email.reason = "no email recipients";
      }
    } else {
      out.email.reason = "already notified";
    }
  } catch (e) {
    out.email.reason = String((e as Error)?.message ?? e);
  }

  // ── SMS → opted-in volunteers (quiet hours enforced by the drain) ──
  try {
    if (await claimNotify(event.id, "Sms")) {
      const phones = await resolveSmsRecipients(["volunteers"]);
      if (phones.length) {
        const body = withCompliance(`${event.title} — ${when}${locline ? `, ${locline}` : ""}. RSVP: ${rsvpUrl}`);
        await createSmsCampaign({ body, audience: "Volunteers", recipients: phones, createdBy: by });
        out.sms.queued = true;
      } else {
        out.sms.reason = "no opted-in volunteer numbers";
      }
    } else {
      out.sms.reason = "already notified";
    }
  } catch (e) {
    out.sms.reason = String((e as Error)?.message ?? e);
  }

  return out;
}
