// Branded HTML email shell — shared by every transactional + broadcast email so
// they all carry the same red/white/blue identity, logo, imagery, and the
// required campaign disclaimer + unsubscribe. Table-based + inline styles for
// broad email-client support (Outlook/Gmail/Apple Mail).
import { CAMPAIGN } from "@/lib/site";

const CDN = "https://d5jzyan9wboi3.cloudfront.net";
const C = {
  navy: "#0F2540",
  navy2: "#16365C",
  red: "#B5343B",
  blue: "#2563EB",
  paper: "#FBFAF6",
  ink: "#0F2540",
  body: "#374151",
  muted: "#6B7280",
  line: "#E4E2DA",
  white: "#ffffff",
};

export type EmailButton = { label: string; href: string; color?: "red" | "blue" | "navy" };
export type EmailOpts = {
  preheader?: string; // hidden inbox-preview line
  eyebrow?: string;
  title: string;
  heroImage?: { src: string; alt: string }; // CDN URL
  bodyHtml: string; // inner HTML (paragraphs/lists already marked up)
  button?: EmailButton;
  // CAN-SPAM: a working unsubscribe link is required for broadcast email.
  unsubscribeUrl?: string;
};

const BTN_BG = { red: C.red, blue: C.blue, navy: C.navy };

export function emailButton(b: EmailButton): string {
  const bg = BTN_BG[b.color ?? "red"];
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td align="center" bgcolor="${bg}" style="border-radius:4px;">
      <a href="${b.href}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:4px;">${b.label}</a>
    </td></tr>
  </table>`;
}

export function renderEmail(o: EmailOpts): string {
  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${o.preheader}</div>`
    : "";
  const hero = o.heroImage
    ? `<tr><td><img src="${o.heroImage.src}" alt="${o.heroImage.alt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" /></td></tr>`
    : "";
  const eyebrow = o.eyebrow
    ? `<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${C.blue};">${o.eyebrow}</p>`
    : "";
  const button = o.button ? emailButton(o.button) : "";
  const unsub = o.unsubscribeUrl
    ? ` &nbsp;·&nbsp; <a href="${o.unsubscribeUrl}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a>`
    : "";

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${o.title}</title>
</head>
<body style="margin:0;padding:0;background:${C.paper};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${C.white};border:1px solid ${C.line};border-radius:8px;overflow:hidden;">
      <!-- top rule: red/white/blue -->
      <tr><td style="height:5px;line-height:5px;font-size:0;background:${C.red};">&nbsp;</td></tr>
      <!-- header -->
      <tr><td style="background:${C.navy};padding:20px 28px;" align="left">
        <img src="${CDN}/public/brand/logo-white.png" alt="${CAMPAIGN.candidate} for Congress" height="40" style="display:block;height:40px;width:auto;border:0;" />
      </td></tr>
      ${hero}
      <!-- content -->
      <tr><td style="padding:32px 28px 8px;">
        ${eyebrow}
        <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:${C.ink};">${o.title}</h1>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${C.body};">${o.bodyHtml}</div>
        ${button}
      </td></tr>
      <!-- footer -->
      <tr><td style="padding:24px 28px;border-top:1px solid ${C.line};background:${C.paper};">
        <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${C.muted};">
          ${CAMPAIGN.committee}<br>${CAMPAIGN.address}
        </p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${C.muted};">
          ${CAMPAIGN.paidForBy}${unsub}
        </p>
      </td></tr>
    </table>
    <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${C.muted};">
      ${CAMPAIGN.candidate} · ${CAMPAIGN.district} · Primary ${CAMPAIGN.electionLabel}
    </p>
  </td></tr>
</table>
</body></html>`;
}

// Plain-text alternative (multipart). Pass the same blocks as simple strings.
export function renderText(opts: { title: string; lines: string[]; buttonUrl?: string; unsubscribeUrl?: string }): string {
  const parts = [
    opts.title,
    "",
    ...opts.lines,
  ];
  if (opts.buttonUrl) parts.push("", opts.buttonUrl);
  parts.push("", "—", `${CAMPAIGN.committee}`, CAMPAIGN.address, CAMPAIGN.paidForBy);
  if (opts.unsubscribeUrl) parts.push(`Unsubscribe: ${opts.unsubscribeUrl}`);
  return parts.join("\n");
}

export const EMAIL_CDN = CDN;
