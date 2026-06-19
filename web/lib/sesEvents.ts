// Pure classifier for SES→SNS notification events, extracted from the webhook
// route so the routing rules are unit-testable (sesEvents.test.ts). The route
// owns signature verification and the side effects (suppress / recordEngagement).
//
// Key rule: ONLY permanent bounces suppress. Suppressing on a transient bounce
// (mailbox full, greylisting) would wrongly kill a deliverable address.

export type SesEvent = {
  eventType?: string;
  notificationType?: string;
  bounce?: { bounceType?: string; bouncedRecipients?: { emailAddress?: string }[] };
  complaint?: { complainedRecipients?: { emailAddress?: string }[] };
  mail?: { tags?: Record<string, string[]> };
};

export type SesAction =
  | { kind: "engagement"; campaignId: string; event: "delivered" | "open" | "click" }
  | { kind: "suppress"; emails: string[]; reason: "bounced" | "complained" }
  | { kind: "ignore" };

const emailsOf = (recips?: { emailAddress?: string }[]): string[] =>
  (recips ?? []).map((r) => r.emailAddress).filter((e): e is string => !!e);

export function classifySesEvent(event: SesEvent): SesAction {
  const kind = event.eventType ?? event.notificationType;

  if (kind === "Delivery" || kind === "Open" || kind === "Click") {
    const campaignId = event.mail?.tags?.campaign_id?.[0];
    if (!campaignId) return { kind: "ignore" };
    return { kind: "engagement", campaignId, event: kind === "Delivery" ? "delivered" : kind === "Open" ? "open" : "click" };
  }

  if (kind === "Bounce" && event.bounce?.bounceType === "Permanent") {
    const emails = emailsOf(event.bounce.bouncedRecipients);
    return emails.length ? { kind: "suppress", emails, reason: "bounced" } : { kind: "ignore" };
  }

  if (kind === "Complaint") {
    const emails = emailsOf(event.complaint?.complainedRecipients);
    return emails.length ? { kind: "suppress", emails, reason: "complained" } : { kind: "ignore" };
  }

  return { kind: "ignore" };
}
