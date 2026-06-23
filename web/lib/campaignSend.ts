import { sendEmail } from "@/lib/email/send";
import { unsubscribeUrl, unsubscribeApiUrl } from "@/lib/subscribers";
import { CAMPAIGN } from "@/lib/site";
import type { Email } from "@/lib/email/templates";

// Send one pre-rendered broadcast email. Staff variables are already filled into
// the Email by the broadcast template; here we add the per-recipient
// personalization ({{first_name}}), the unsubscribe/preferences URLs, and the
// RFC 8058 List-Unsubscribe headers. firstName falls back to a neutral greeting
// so the send-layer safety net never blocks on an unfilled token.
export async function sendBroadcastEmail(o: { to: string; email: Email; base: string; campaignId?: string; firstName?: string }) {
  const u = await unsubscribeUrl(o.base, o.to);
  const oneClick = await unsubscribeApiUrl(o.base, o.to);
  return sendEmail({
    to: o.to,
    subject: o.email.subject,
    html: o.email.html,
    text: o.email.text,
    tokens: { unsubscribe_url: u, preferences_url: u, first_name: o.firstName?.trim() || "there" },
    headers: [
      { name: "List-Unsubscribe", value: `<${oneClick}>, <mailto:${CAMPAIGN.email}?subject=unsubscribe>` },
      { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
    ],
    // Tag with the campaign so SES open/click events attribute back (analytics).
    tags: o.campaignId ? [{ name: "campaign_id", value: o.campaignId }] : undefined,
  });
}
