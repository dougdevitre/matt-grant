import { sendEmail } from "@/lib/email/send";
import { renderEmail, renderText } from "@/lib/email/layout";
import { unsubscribeUrl } from "@/lib/subscribers";

// Render + send one broadcast email (shared by the test send and the batch
// drainer). The branded shell already carries the committee address + "Paid
// for by"; we inject the per-recipient unsubscribe URL.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function bodyToHtml(body: string): string {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export async function sendCampaignEmail(o: { to: string; subject: string; body: string; base: string; test?: boolean }) {
  const u = unsubscribeUrl(o.base, o.to);
  return sendEmail({
    to: o.to,
    subject: o.test ? `[TEST] ${o.subject}` : o.subject,
    html: renderEmail({ eyebrow: "Campaign update", title: o.subject, bodyHtml: bodyToHtml(o.body), unsubscribeUrl: u }),
    text: renderText({ title: o.subject, lines: [o.body], unsubscribeUrl: u }),
    tokens: { unsubscribe_url: u, preferences_url: u },
  });
}
