import { renderEmail, renderText } from "@/lib/email/layout";
import { SITE_URL } from "@/lib/site";

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

// Transactional donor thank-you. Built on the branded transactional layout, which
// already carries the FEC "paid for by" footer and adds NO unsubscribe merge
// tokens — so it passes the send-layer's leftover-token guard. Admin-triggered
// (not auto-sent from recordContribution), so importing historical gifts never
// emails donors retroactively.
export function donorThankYouEmail(name?: string | null): { subject: string; html: string; text: string } {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  const greetingHtml = first ? `${esc(first)}, ` : "";
  const subject = "Thank you for standing with Matt Grant";
  const html = renderEmail({
    eyebrow: "A note of thanks",
    title: "Thank you.",
    bodyHtml:
      `<p>${greetingHtml}thank you for your contribution to Matt Grant for Congress. Grassroots support like yours is what powers this campaign to restore trust in Missouri's 2nd District.</p>` +
      `<p>Every dollar goes straight to reaching voters before the August 4 primary — and it means a great deal to have you with us.</p>` +
      `<p style="font-size:13px;color:#8A93A3;">Contributions to Matt Grant for Congress are not deductible as charitable contributions for federal income tax purposes.</p>`,
    button: { label: "See the four priorities", href: `${SITE_URL}/issues`, color: "red" },
  });
  const text = renderText({
    title: "Thank you",
    lines: [
      `${first ? `${first}, ` : ""}thank you for your contribution to Matt Grant for Congress.`,
      "Every dollar helps us reach voters before the August 4 primary.",
      "Contributions are not deductible as charitable contributions for federal income tax purposes.",
    ],
    buttonUrl: `${SITE_URL}/issues`,
  });
  return { subject, html, text };
}
