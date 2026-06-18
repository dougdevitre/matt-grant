// Email templates — transactional (1:1, triggered) and broadcast (1:many). All
// share the branded shell in layout.ts. Copy is faithful to candidate/platform.md;
// no invented facts. CTAs that are event/campaign-specific use {{placeholder}}
// tokens that staff fill at send time.
import { renderEmail, renderText, EMAIL_CDN, type EmailCard } from "./layout";
import { CAMPAIGN, SITE_URL } from "@/lib/site";
import { ISSUES, getIssue, type Issue } from "@/lib/issues";

export type Email = { subject: string; html: string; text: string };
const img = (path: string) => `${EMAIL_CDN}/public/${path}`;
const UNSUB = "{{unsubscribe_url}}"; // replaced per recipient at send time

const issueCard = (i: Issue): EmailCard => ({
  img: { src: i.graphic, alt: i.title },
  heading: i.title,
  text: i.tagline,
  href: `${SITE_URL}/issues/${i.slug}`,
  linkLabel: "Read the argument →",
});

// ─────────────────────────── Transactional ───────────────────────────

export function volunteerWelcome(firstName = "there"): Email {
  const title = `Welcome to the team, ${firstName}.`;
  return {
    subject: "Welcome to the Matt Grant for Congress team",
    html: renderEmail({
      preheader: "Thanks for stepping up — here's how to start.",
      eyebrow: "Welcome aboard",
      title,
      heroImage: { src: img("marketing/banner-standard-of-service.png"), alt: "A New Standard of Service" },
      bodyHtml: `<p>Thank you for joining the campaign. This race is won one neighbor at a time, and you just made it stronger.</p>
        <p>Here's how to make an immediate difference:</p>
        <ul>
          <li><strong>Share the message</strong> — grab ready-to-post graphics and captions.</li>
          <li><strong>Talk to your neighbors</strong> about putting Missouri's children first.</li>
          <li><strong>Chip in</strong> if you're able — every dollar funds doors and calls.</li>
        </ul>`,
      signature: true,
      button: { label: "Get your toolkit", href: `${SITE_URL}/media`, color: "blue" },
      secondaryButton: { label: "Donate", href: CAMPAIGN.donateUrl, color: "red" },
    }),
    text: renderText({ title, lines: ["Thank you for joining the campaign. This race is won one neighbor at a time.", "", "Get your toolkit: " + `${SITE_URL}/media`] }),
  };
}

export function donationThankYou(firstName = "Friend", amount?: number): Email {
  const amt = amount ? `$${amount}` : "your gift";
  const title = `Thank you, ${firstName}.`;
  return {
    subject: "Thank you for supporting Matt Grant for Congress",
    html: renderEmail({
      preheader: "Your support funds doors knocked and calls made.",
      eyebrow: "Receipt of support",
      title,
      bodyHtml: `<p>Your contribution of <strong>${amt}</strong> goes straight to the work: doors knocked, calls made, and neighbors reached before ${CAMPAIGN.electionLabel}.</p>
        <p>Matt doesn't just talk — he takes action, and so do you. Thank you for being part of it.</p>
        <p style="font-size:13px;color:#6B7280;">Contributions to ${CAMPAIGN.committee} are not tax-deductible. Federal law requires us to use best efforts to collect and report the name, mailing address, occupation, and employer of individuals whose contributions exceed $200 in an election cycle.</p>`,
      signature: true,
      button: { label: "Share why you gave", href: `${SITE_URL}/media`, color: "red" },
    }),
    text: renderText({ title, lines: [`Your contribution of ${amt} funds doors, calls, and neighbors reached before ${CAMPAIGN.electionLabel}. Thank you.`] }),
  };
}

export function contactReceipt(firstName = "there"): Email {
  const title = "We got your message.";
  return {
    subject: "We received your message — Matt Grant for Congress",
    html: renderEmail({
      preheader: "Thanks for reaching out. We'll be in touch.",
      eyebrow: "Message received",
      title,
      bodyHtml: `<p>Thanks for reaching out, ${firstName}. A member of the campaign will get back to you soon.</p>
        <p>In the meantime, here's where Matt stands on the four fights that matter for Missouri's 2nd District.</p>`,
      button: { label: "See the issues", href: `${SITE_URL}/issues`, color: "navy" },
    }),
    text: renderText({ title, lines: [`Thanks for reaching out, ${firstName}. We'll be in touch.`, "", "See the issues: " + `${SITE_URL}/issues`] }),
  };
}

// ──────────────────────────── Broadcast ────────────────────────────

export function issueSpotlight(slug: string): Email {
  const issue = getIssue(slug) ?? ISSUES[0];
  const others = ISSUES.filter((i) => i.slug !== issue.slug).slice(0, 3).map(issueCard);
  return {
    subject: `Where Matt stands: ${issue.title}`,
    html: renderEmail({
      preheader: issue.tagline,
      eyebrow: issue.eyebrow,
      title: issue.title,
      heroImage: { src: issue.graphic, alt: issue.title },
      bodyHtml: `<p>${issue.argument}</p>
        <p><strong>Matt's commitment:</strong> ${issue.commitment}</p>
        <p style="margin-top:20px;font-weight:bold;color:#0F2540;">Explore the other fights:</p>`,
      cards: others,
      button: { label: "Read the full argument", href: `${SITE_URL}/issues/${issue.slug}`, color: "blue" },
      secondaryButton: { label: "Donate", href: CAMPAIGN.donateUrl, color: "red" },
      unsubscribeUrl: UNSUB,
    }),
    text: renderText({
      title: issue.title,
      lines: [issue.argument, "", `Matt's commitment: ${issue.commitment}`, "", `Read more: ${SITE_URL}/issues/${issue.slug}`],
      unsubscribeUrl: UNSUB,
    }),
  };
}

export function campaignNewsletter(): Email {
  const title = "Four fights worth winning";
  return {
    subject: "The four fights — and how you can help",
    html: renderEmail({
      preheader: "Where Matt stands, and your plan to help.",
      eyebrow: "Campaign update",
      title,
      heroImage: { src: img("marketing/infographic.png"), alt: "The Four Fights" },
      bodyHtml: `<p>Here's where Matt stands on the issues that matter most for Missouri's 2nd District — and how you can move this race forward before ${CAMPAIGN.electionLabel}.</p>`,
      cards: ISSUES.map(issueCard),
      signature: true,
      button: { label: "Get involved", href: `${SITE_URL}/contact`, color: "blue" },
      secondaryButton: { label: "Donate", href: CAMPAIGN.donateUrl, color: "red" },
      unsubscribeUrl: UNSUB,
    }),
    text: renderText({ title, lines: ISSUES.map((i) => `• ${i.title}: ${i.tagline} (${SITE_URL}/issues/${i.slug})`), unsubscribeUrl: UNSUB }),
  };
}

export function gotvReminder(daysOut = 7): Email {
  const title = daysOut <= 1 ? "Tomorrow is election day." : `${daysOut} days to make it count.`;
  return {
    subject: daysOut <= 1 ? "Vote tomorrow for Matt Grant" : `${daysOut} days left — here's your plan to vote`,
    html: renderEmail({
      preheader: `Primary election: ${CAMPAIGN.electionLabel}.`,
      eyebrow: "Get out the vote",
      title,
      heroImage: { src: img("social/feed/D-1.png"), alt: "Election day — go vote" },
      bodyHtml: `<p>The primary is <strong>${CAMPAIGN.electionLabel}</strong>. Every vote in this race counts — make your plan now.</p>
        <ul>
          <li>Confirm your polling place and hours.</li>
          <li>Bring a friend or neighbor.</li>
          <li>Vote for a Congress that shows up — vote Matt Grant.</li>
        </ul>`,
      // CTA placeholder: drop in the official lookup URL at send time.
      button: { label: "Find your polling place", href: "{{polling_place_url}}", color: "red" },
      secondaryButton: { label: "Donate", href: CAMPAIGN.donateUrl, color: "navy" },
      unsubscribeUrl: UNSUB,
    }),
    text: renderText({ title, lines: [`The primary is ${CAMPAIGN.electionLabel}. Make your plan to vote.`], buttonUrl: "{{polling_place_url}}", unsubscribeUrl: UNSUB }),
  };
}

export function fundraisingAppeal(): Email {
  const title = "Fuel the final stretch.";
  return {
    subject: "Chip in before the deadline — Matt Grant for Congress",
    html: renderEmail({
      preheader: "Every dollar funds doors, calls, and mail.",
      eyebrow: "Chip in",
      title,
      heroImage: { src: img("marketing/flyers/mg-flyer-solutions-for-missouri-families.png"), alt: "Solutions for Missouri families" },
      bodyHtml: `<p>We're in the final stretch before ${CAMPAIGN.electionLabel}, and grassroots support is what carries this campaign — not Washington insiders.</p>
        <p>A gift today funds the doors, calls, and mail that reach one more Missouri family.</p>`,
      signature: true,
      button: { label: "Donate now", href: CAMPAIGN.donateUrl, color: "red" },
      unsubscribeUrl: UNSUB,
    }),
    text: renderText({ title, lines: [`We're in the final stretch before ${CAMPAIGN.electionLabel}. A gift today funds doors, calls, and mail.`], buttonUrl: CAMPAIGN.donateUrl, unsubscribeUrl: UNSUB }),
  };
}

// Event invite — fully placeholder-driven CTAs for staff to fill per event.
export function eventInvite(): Email {
  return {
    subject: "You're invited: {{event_title}}",
    html: renderEmail({
      preheader: "{{event_date}} · {{event_location}}",
      eyebrow: "You're invited",
      title: "{{event_title}}",
      heroImage: { src: img("web/st-louis-arch.png"), alt: "Join Matt Grant" },
      bodyHtml: `<p>Join Matt Grant and neighbors across Missouri's 2nd District.</p>
        <p><strong>When:</strong> {{event_date}}<br><strong>Where:</strong> {{event_location}}</p>
        <p>{{event_details}}</p>`,
      button: { label: "RSVP now", href: "{{rsvp_url}}", color: "red" },
      secondaryButton: { label: "Add to calendar", href: "{{calendar_url}}", color: "navy" },
      unsubscribeUrl: UNSUB,
    }),
    text: renderText({ title: "{{event_title}}", lines: ["When: {{event_date}}", "Where: {{event_location}}", "{{event_details}}"], buttonUrl: "{{rsvp_url}}", unsubscribeUrl: UNSUB }),
  };
}

// Generic announcement — headline/body/CTA all placeholders for quick blasts.
export function announcement(): Email {
  return {
    subject: "{{subject}}",
    html: renderEmail({
      preheader: "{{preheader}}",
      eyebrow: "{{eyebrow}}",
      title: "{{headline}}",
      heroImage: { src: img("marketing/banner-standard-of-service.png"), alt: "Matt Grant for Congress" },
      bodyHtml: `<p>{{body}}</p>`,
      signature: true,
      button: { label: "{{cta_label}}", href: "{{cta_url}}", color: "red" },
      unsubscribeUrl: UNSUB,
    }),
    text: renderText({ title: "{{headline}}", lines: ["{{body}}"], buttonUrl: "{{cta_url}}", unsubscribeUrl: UNSUB }),
  };
}

// Registry for previews / sends.
export const EMAIL_TEMPLATES: { key: string; kind: "transactional" | "broadcast"; build: () => Email }[] = [
  { key: "volunteer-welcome", kind: "transactional", build: () => volunteerWelcome("Sam") },
  { key: "donation-thank-you", kind: "transactional", build: () => donationThankYou("Sam", 50) },
  { key: "contact-receipt", kind: "transactional", build: () => contactReceipt("Sam") },
  { key: "campaign-newsletter", kind: "broadcast", build: () => campaignNewsletter() },
  { key: "issue-spotlight-family-courts", kind: "broadcast", build: () => issueSpotlight("family-courts") },
  { key: "gotv-reminder", kind: "broadcast", build: () => gotvReminder(7) },
  { key: "fundraising-appeal", kind: "broadcast", build: () => fundraisingAppeal() },
  { key: "event-invite", kind: "broadcast", build: () => eventInvite() },
  { key: "announcement", kind: "broadcast", build: () => announcement() },
];
