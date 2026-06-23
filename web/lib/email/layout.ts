// Branded HTML email shell — designed to a professional campaign standard:
// the campaign's own typefaces (Fraunces display / Public Sans) via webfont with
// web-safe fallbacks, restrained red/white/blue, generous whitespace, an
// editorial card style, and a refined masthead + footer. Table-based + inline
// styles for Outlook/Gmail/Apple Mail. CAN-SPAM + FEC built in.
import { CAMPAIGN } from "@/lib/site";

const CDN = "https://d5jzyan9wboi3.cloudfront.net";

// Refined palette — navy authority, a single warm red accent, blue for links,
// lots of paper-white, hairline neutrals. Used inline throughout.
const C = {
  navy: "#0F2540", // headlines / masthead
  ink: "#33425A", // body text
  red: "#B23A3F", // accent / primary button / eyebrow
  blue: "#1F5FCb", // links
  bg: "#F1EFE8", // outer canvas (warm paper)
  white: "#ffffff",
  hair: "#E6E2D8", // hairline rules
  muted: "#8A93A3", // captions / footer
  soft: "#5B6678",
};

const DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif";
const SANS = "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

export type EmailButton = { label: string; href: string; color?: "red" | "blue" | "navy" };
export type EmailCard = { img: { src: string; alt: string }; heading: string; text: string; href: string; linkLabel?: string };
export type EmailOpts = {
  preheader?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  heroImage?: { src: string; alt: string };
  bodyHtml: string;
  greeting?: boolean; // prepend "Hi {{first_name}}," to the body (broadcast personalization)
  signature?: boolean;
  cards?: EmailCard[];
  button?: EmailButton;
  secondaryButton?: EmailButton; // rendered as a refined text link
  unsubscribeUrl?: string;
};

const BTN_BG = { red: C.red, blue: C.blue, navy: C.navy };

export function emailButton(b: EmailButton): string {
  const bg = BTN_BG[b.color ?? "red"];
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0;"><tr>
    <td align="center" bgcolor="${bg}" style="border-radius:3px;">
      <a href="${b.href}" target="_blank" style="display:inline-block;padding:15px 36px;font-family:${SANS};font-size:15px;font-weight:700;letter-spacing:0.4px;color:#ffffff;text-decoration:none;border-radius:3px;">${b.label}</a>
    </td></tr></table>`;
}

export function renderEmail(o: EmailOpts): string {
  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${o.preheader}</div>`
    : "";
  const hero = o.heroImage
    ? `<tr><td style="padding:0;"><img src="${o.heroImage.src}" alt="${o.heroImage.alt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" /></td></tr>
       <tr><td style="height:1px;line-height:1px;font-size:0;background:${C.hair};">&nbsp;</td></tr>`
    : "";
  const eyebrow = o.eyebrow
    ? `<p style="margin:0 0 14px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${C.red};">${o.eyebrow}</p>`
    : "";
  const subtitle = o.subtitle
    ? `<p style="margin:0 0 24px;font-family:${SANS};font-size:17px;line-height:1.55;color:${C.soft};">${o.subtitle}</p>`
    : "";
  const primary = o.button ? emailButton(o.button) : "";
  const secondary = o.secondaryButton
    ? `<p style="margin:14px 0 0;font-family:${SANS};font-size:14px;"><a href="${o.secondaryButton.href}" target="_blank" style="color:${C.navy};font-weight:700;text-decoration:none;border-bottom:2px solid ${C.hair};padding-bottom:2px;">${o.secondaryButton.label} →</a></p>`
    : "";
  const buttons = primary || secondary ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 4px;"><tr><td>${primary}${secondary}</td></tr></table>` : "";
  const cards = (o.cards ?? [])
    .map(
      (c, i) => `<tr><td style="padding:${i === 0 ? "8" : "26"}px 40px 0;">
        ${i === 0 ? "" : `<div style="height:1px;background:${C.hair};margin-bottom:26px;"></div>`}
        <a href="${c.href}" target="_blank"><img src="${c.img.src}" alt="${c.img.alt}" width="520" style="display:block;width:100%;height:auto;border:0;border-radius:4px;" /></a>
        <p style="margin:16px 0 6px;font-family:${DISPLAY};font-size:20px;font-weight:600;line-height:1.25;color:${C.navy};">${c.heading}</p>
        <p style="margin:0 0 10px;font-family:${SANS};font-size:15px;line-height:1.55;color:${C.soft};">${c.text}</p>
        <a href="${c.href}" target="_blank" style="font-family:${SANS};font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${C.blue};text-decoration:none;">${c.linkLabel ?? "Read more →"}</a>
      </td></tr>`,
    )
    .join("");
  const signature = o.signature
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 6px;"><tr>
        <td style="padding-right:14px;" valign="middle"><img src="${CDN}/public/brand/avatar-circle.png" alt="Matt Grant" width="52" height="52" style="display:block;border-radius:50%;border:0;" /></td>
        <td valign="middle">
          <p style="margin:0;font-family:${DISPLAY};font-size:19px;font-weight:600;color:${C.navy};">Matt Grant</p>
          <p style="margin:2px 0 0;font-family:${SANS};font-size:12px;letter-spacing:0.3px;color:${C.muted};">Candidate · U.S. House · ${CAMPAIGN.districtShort}</p>
        </td></tr></table>`
    : "";
  const unsub = o.unsubscribeUrl
    ? `<br><a href="${o.unsubscribeUrl}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a> &nbsp;·&nbsp; <a href="{{preferences_url}}" style="color:${C.muted};text-decoration:underline;">Update preferences</a>`
    : "";

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${o.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Public+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>a{text-decoration:none} @media (max-width:600px){.px{padding-left:24px!important;padding-right:24px!important}}</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-font-smoothing:antialiased;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${C.white};border:1px solid ${C.hair};">
      <!-- flag accent rule -->
      <tr><td style="font-size:0;line-height:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="45%" style="height:4px;background:${C.red};"></td><td width="10%" style="height:4px;background:${C.white};"></td><td width="45%" style="height:4px;background:${C.blue};"></td>
        </tr></table>
      </td></tr>
      <!-- masthead -->
      <tr><td class="px" style="padding:26px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle"><img src="${CDN}/public/brand/logo.png" alt="${CAMPAIGN.candidate} for Congress" height="34" style="display:block;height:34px;width:auto;border:0;" /></td>
          <td valign="middle" align="right"><span style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.muted};">Missouri · District 2</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="height:1px;line-height:1px;font-size:0;background:${C.hair};">&nbsp;</td></tr>
      ${hero}
      <!-- content -->
      <tr><td class="px" style="padding:38px 40px 8px;">
        ${eyebrow}
        <h1 style="margin:0 0 ${o.subtitle ? "14" : "22"}px;font-family:${DISPLAY};font-size:32px;font-weight:600;line-height:1.18;letter-spacing:-0.3px;color:${C.navy};">${o.title}</h1>
        ${subtitle}
        <div style="font-family:${SANS};font-size:16px;line-height:1.7;color:${C.ink};">${o.greeting ? `<p style="margin:0 0 16px;">Hi {{first_name}},</p>` : ""}${o.bodyHtml}</div>
        ${signature}
        ${buttons}
      </td></tr>
      ${cards ? `<tr><td style="height:8px;"></td></tr>${cards}<tr><td style="height:8px;"></td></tr>` : ""}
      <!-- footer -->
      <tr><td style="height:1px;line-height:1px;font-size:0;background:${C.hair};">&nbsp;</td></tr>
      <tr><td class="px" style="padding:28px 40px 32px;background:${C.white};">
        <p style="margin:0 0 12px;font-family:${SANS};font-size:13px;font-weight:700;letter-spacing:0.3px;color:${C.navy};">${CAMPAIGN.candidate} for Congress</p>
        <p style="margin:0 0 14px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};">${CAMPAIGN.address}</p>
        <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.7;color:${C.muted};">
          ${CAMPAIGN.paidForBy}${unsub}
        </p>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;font-family:${SANS};font-size:11px;letter-spacing:0.3px;color:${C.muted};">Primary Election · ${CAMPAIGN.electionLabel}</p>
  </td></tr>
</table>
</body></html>`;
}

// Plain-text alternative (multipart).
export function renderText(opts: { title: string; lines: string[]; buttonUrl?: string; unsubscribeUrl?: string; greeting?: boolean }): string {
  const parts = [opts.title, "", ...(opts.greeting ? ["Hi {{first_name}},", ""] : []), ...opts.lines];
  if (opts.buttonUrl) parts.push("", opts.buttonUrl);
  parts.push("", "—", `${CAMPAIGN.candidate} for Congress`, CAMPAIGN.address, CAMPAIGN.paidForBy);
  if (opts.unsubscribeUrl) parts.push(`Unsubscribe: ${opts.unsubscribeUrl}`);
  return parts.join("\n");
}

export const EMAIL_CDN = CDN;
