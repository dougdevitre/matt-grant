// Email templates — transactional (1:1, triggered by an action) and broadcast
// (1:many, sent to a list). All share the branded shell in layout.ts. Copy is
// faithful to candidate/platform.md; no invented facts, quotes, or endorsements.
import { renderEmail, renderText, EMAIL_CDN } from "./layout";
import { CAMPAIGN, SITE_URL } from "@/lib/site";
import { ISSUES, getIssue } from "@/lib/issues";

export type Email = { subject: string; html: string; text: string };
const img = (path: string) => `${EMAIL_CDN}/public/${path}`;
const UNSUB = "{{unsubscribe_url}}"; // replaced at send time per recipient

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
      button: { label: "Get your toolkit", href: `${SITE_URL}/media`, color: "blue" },
    }),
    text: renderText({
      title,
      lines: ["Thank you for joining the campaign. This race is won one neighbor at a time.", "", "Get your toolkit: " + `${SITE_URL}/media`],
    }),
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
  return {
    subject: `Where Matt stands: ${issue.title}`,
    html: renderEmail({
      preheader: issue.tagline,
      eyebrow: issue.eyebrow,
      title: issue.title,
      heroImage: { src: issue.graphic, alt: issue.title },
      bodyHtml: `<p>${issue.argument}</p>
        <p><strong>Matt's commitment:</strong> ${issue.commitment}</p>`,
      button: { label: "Read the full argument", href: `${SITE_URL}/issues/${issue.slug}`, color: "blue" },
      unsubscribeUrl: UNSUB,
    }),
    text: renderText({
      title: issue.title,
      lines: [issue.argument, "", `Matt's commitment: ${issue.commitment}`, "", `Read more: ${SITE_URL}/issues/${issue.slug}`],
      unsubscribeUrl: UNSUB,
    }),
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
      button: { label: "Make your plan to vote", href: SITE_URL, color: "red" },
      unsubscribeUrl: UNSUB,
    }),
    text: renderText({ title, lines: [`The primary is ${CAMPAIGN.electionLabel}. Make your plan to vote.`], buttonUrl: SITE_URL, unsubscribeUrl: UNSUB }),
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
      button: { label: "Donate now", href: CAMPAIGN.donateUrl, color: "red" },
      unsubscribeUrl: UNSUB,
    }),
    text: renderText({ title, lines: [`We're in the final stretch before ${CAMPAIGN.electionLabel}. A gift today funds doors, calls, and mail.`], buttonUrl: CAMPAIGN.donateUrl, unsubscribeUrl: UNSUB }),
  };
}

// Registry for previews / sends.
export const EMAIL_TEMPLATES: { key: string; kind: "transactional" | "broadcast"; build: () => Email }[] = [
  { key: "volunteer-welcome", kind: "transactional", build: () => volunteerWelcome("Sam") },
  { key: "donation-thank-you", kind: "transactional", build: () => donationThankYou("Sam", 50) },
  { key: "contact-receipt", kind: "transactional", build: () => contactReceipt("Sam") },
  { key: "issue-spotlight-family-courts", kind: "broadcast", build: () => issueSpotlight("family-courts") },
  { key: "gotv-reminder", kind: "broadcast", build: () => gotvReminder(7) },
  { key: "fundraising-appeal", kind: "broadcast", build: () => fundraisingAppeal() },
];
