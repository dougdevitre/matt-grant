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
      subtitle: "You just made this campaign stronger. Here's how to start making a difference.",
      heroImage: { src: img("brand/headshot.png"), alt: "Matt Grant" },
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

export function supporterWelcome(firstName = "there"): Email {
  const title = `Welcome to the community, ${firstName}.`;
  return {
    subject: "You're in — welcome to the Matt Grant for Congress community",
    html: renderEmail({
      preheader: "You just joined the movement to restore public trust in MO-02.",
      eyebrow: "You're in",
      title,
      subtitle: "You just joined the movement to restore public trust in Missouri's 2nd District.",
      heroImage: { src: img("brand/headshot.png"), alt: "Matt Grant" },
      bodyHtml: `<p>Thanks for joining — it's good to have you. This race is won one neighbor at a time, and you just made it stronger.</p>
        <p>Here's how to make an immediate difference:</p>
        <ul>
          <li><strong>See the case for change</strong> — the data on why it's time for new leadership in MO-02.</li>
          <li><strong>Share it</strong> — bring a neighbor into the community.</li>
          <li><strong>Chip in</strong> if you're able — every dollar funds doors, calls, and mail before ${CAMPAIGN.electionLabel}.</li>
        </ul>`,
      signature: true,
      button: { label: "Enter your community", href: `${SITE_URL}/community`, color: "blue" },
      secondaryButton: { label: "Donate", href: CAMPAIGN.donateUrl, color: "red" },
    }),
    text: renderText({
      title,
      lines: [
        "Thanks for joining the Matt Grant for Congress community. This race is won one neighbor at a time.",
        "",
        "Enter your community: " + `${SITE_URL}/community`,
      ],
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
      subtitle: "Your support is the engine of this campaign — thank you.",
      heroImage: { src: img("brand/headshot.png"), alt: "Matt Grant" },
      bodyHtml: `<p>Your contribution of <strong>${amt}</strong> goes straight to the work: doors knocked, calls made, and neighbors reached before ${CAMPAIGN.electionLabel}.</p>
        <p>Matt doesn't just talk — he takes action, and so do you. Thank you for being part of it.</p>
        <p style="font-size:13px;color:#6B7280;">Contributions to ${CAMPAIGN.committee} are not tax-deductible. Federal law requires us to use best efforts to collect and report the name, mailing address, occupation, and employer of individuals whose contributions exceed $200 in an election cycle.</p>`,
      signature: true,
      button: { label: "Visit your community", href: `${SITE_URL}/community`, color: "blue" },
      secondaryButton: { label: "Share why you gave", href: `${SITE_URL}/media`, color: "red" },
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
      heroImage: { src: img("brand/headshot.png"), alt: "Matt Grant" },
      bodyHtml: `<p>Thanks for reaching out, ${firstName}. A member of the campaign will get back to you soon.</p>
        <p>In the meantime, join the community to follow the case for change, find ways to help, and get updates from the campaign.</p>`,
      button: { label: "Join the community", href: `${SITE_URL}/community`, color: "blue" },
      secondaryButton: { label: "See the issues", href: `${SITE_URL}/issues`, color: "navy" },
    }),
    text: renderText({ title, lines: [`Thanks for reaching out, ${firstName}. We'll be in touch.`, "", "Join the community: " + `${SITE_URL}/community`] }),
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
      greeting: true,
      eyebrow: issue.eyebrow,
      title: issue.title,
      subtitle: issue.tagline,
      bodyHtml: `<p>${issue.argument}</p>
        <p><strong>Matt's commitment:</strong> ${issue.commitment}</p>
        <p style="margin-top:20px;font-weight:bold;color:#0F2540;">Explore the other priorities:</p>`,
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
  const title = "Four priorities worth standing for";
  return {
    subject: "The four priorities — and how you can help",
    html: renderEmail({
      preheader: "Where Matt stands, and your plan to help.",
      greeting: true,
      eyebrow: "Campaign update",
      title,
      subtitle: "Where Matt stands — and how you can move this race forward.",
      heroImage: { src: img("marketing/infographic.png"), alt: "The Four Priorities" },
      bodyHtml: `<p>Here's where Matt stands on the issues that matter most for Missouri's 2nd District — and how you can move this race forward before ${CAMPAIGN.electionLabel}.</p>`,
      cards: ISSUES.map(issueCard),
      signature: true,
      button: { label: "Join the community", href: `${SITE_URL}/community`, color: "blue" },
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
      greeting: true,
      eyebrow: "Get out the vote",
      title,
      subtitle: `The primary is ${CAMPAIGN.electionLabel}. Make your plan to vote.`,
      heroImage: { src: img("web/st-louis-arch.png"), alt: "Missouri's 2nd District" },
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
      greeting: true,
      eyebrow: "Chip in",
      title,
      subtitle: "Grassroots support — not Washington insiders — carries this campaign.",
      heroImage: { src: img("brand/headshot.png"), alt: "Matt Grant" },
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
      greeting: true,
      eyebrow: "You're invited",
      title: "{{event_title}}",
      heroImage: { src: img("web/st-louis-arch.png"), alt: "Join Matt Grant" },
      bodyHtml: `<p>Join Matt Grant and neighbors across Missouri's 2nd District.</p>
        <p><strong>When:</strong> {{event_date}}<br><strong>Where:</strong> {{event_location}}</p>
        {{event_details}}`,
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
      greeting: true,
      eyebrow: "{{eyebrow}}",
      title: "{{headline}}",
      subtitle: "{{subhead}}",
      heroImage: { src: img("brand/headshot.png"), alt: "Matt Grant" },
      bodyHtml: `{{body}}`,
      signature: true,
      button: { label: "{{cta_label}}", href: "{{cta_url}}", color: "red" },
      unsubscribeUrl: UNSUB,
    }),
    text: renderText({ title: "{{headline}}", lines: ["{{body}}"], buttonUrl: "{{cta_url}}", unsubscribeUrl: UNSUB }),
  };
}

// Registry for previews / sends.
export const EMAIL_TEMPLATES: { key: string; kind: "transactional" | "broadcast"; build: () => Email }[] = [
  { key: "supporter-welcome", kind: "transactional", build: () => supporterWelcome("Sam") },
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
