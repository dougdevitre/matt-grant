import {
  campaignNewsletter,
  issueSpotlight,
  gotvReminder,
  fundraisingAppeal,
  eventInvite,
  announcement,
  type Email,
} from "./templates";
import { ISSUES } from "@/lib/issues";
import type { TopicKey } from "@/lib/subscribers";
import { escapeHtml, safeUrl, richToEmailHtml, richToText } from "./richtext";

// Declarative registry of the broadcast templates staff can send. Each maps to
// a subscriber TOPIC (for preference filtering) and declares the variables the
// composer collects. build(vars) returns the branded Email with staff vars
// filled — leaving only the per-recipient {{unsubscribe_url}}/{{preferences_url}}
// tokens for the send layer.
export type BroadcastField = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  rich?: boolean; // textarea accepts markdown-lite (bold/italic/links/lists) → sanitized HTML
};
export type BroadcastDef = {
  key: string;
  label: string;
  topic: TopicKey;
  description: string;
  fields: BroadcastField[];
  build: (vars: Record<string, string>) => Email;
};

const fillTokens = (s: string, v: Record<string, string>) =>
  s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in v && v[k] ? v[k] : m));

// Fill staff variables into a rendered Email, context-aware so raw input can
// never break or inject into the markup:
//  - HTML body: plain fields are HTML-escaped, *_url fields are scheme-checked,
//    and fields marked `rich` become sanitized markdown-lite HTML.
//  - Subject + plain-text part: raw values (rich fields flattened to plain text).
// Per-recipient tokens (unsubscribe_url, …) carry no staff value here and are
// left in place for the send layer (lib/email/send.ts) to fill.
function applyVars(e: Email, vars: Record<string, string>, fields: BroadcastField[]): Email {
  const rich = new Set(fields.filter((f) => f.rich).map((f) => f.name));
  const htmlVars: Record<string, string> = {};
  const textVars: Record<string, string> = {};
  for (const [k, val] of Object.entries(vars)) {
    htmlVars[k] = rich.has(k) ? richToEmailHtml(val) : /url$/i.test(k) ? escapeHtml(safeUrl(val)) : escapeHtml(val);
    textVars[k] = rich.has(k) ? richToText(val) : val;
  }
  return {
    subject: fillTokens(e.subject, textVars),
    html: fillTokens(e.html, htmlVars),
    text: fillTokens(e.text, textVars),
  };
}

type RenderFn = (vars: Record<string, string>) => Email;
const broadcast = (d: { key: string; label: string; topic: TopicKey; description: string; fields: BroadcastField[]; render: RenderFn }): BroadcastDef => ({
  key: d.key,
  label: d.label,
  topic: d.topic,
  description: d.description,
  fields: d.fields,
  build: (v) => applyVars(d.render(v), v, d.fields),
});

export const BROADCASTS: BroadcastDef[] = [
  broadcast({
    key: "newsletter",
    label: "Campaign newsletter",
    topic: "news",
    description: "The Four Priorities overview + a get-involved CTA. No inputs.",
    fields: [],
    render: () => campaignNewsletter(),
  }),
  broadcast({
    key: "issue",
    label: "Issue spotlight",
    topic: "issues",
    description: "A deep-dive on one of the four issues.",
    fields: [
      { name: "slug", label: "Issue", type: "select", required: true, options: ISSUES.map((i) => ({ value: i.slug, label: i.title })) },
    ],
    render: (v) => issueSpotlight(v.slug || ISSUES[0].slug),
  }),
  broadcast({
    key: "gotv",
    label: "GOTV reminder",
    topic: "gotv",
    description: "Make-a-plan-to-vote reminder for the final stretch.",
    fields: [
      { name: "daysOut", label: "Days until election", type: "number", required: true, placeholder: "7" },
      { name: "polling_place_url", label: "Polling-place lookup URL", type: "text", required: true, placeholder: "https://www.sos.mo.gov/..." },
    ],
    render: (v) => gotvReminder(Number(v.daysOut) || 7),
  }),
  broadcast({
    key: "fundraising",
    label: "Fundraising appeal",
    topic: "fundraising",
    description: "Final-stretch donate ask. No inputs.",
    fields: [],
    render: () => fundraisingAppeal(),
  }),
  broadcast({
    key: "event",
    label: "Event invite",
    topic: "events",
    description: "Invite the list to a campaign event.",
    fields: [
      { name: "event_title", label: "Event title", type: "text", required: true },
      { name: "event_date", label: "Date & time", type: "text", required: true, placeholder: "Saturday, July 12 · 6:00 PM" },
      { name: "event_location", label: "Location", type: "text", required: true },
      { name: "event_details", label: "Details", type: "textarea", required: true, rich: true, placeholder: "What to expect. **Bold**, *italic*, [links](https://…) and - bullets welcome." },
      { name: "rsvp_url", label: "RSVP URL", type: "text", required: true, placeholder: "https://..." },
      { name: "calendar_url", label: "Add-to-calendar URL", type: "text", required: true, placeholder: "https://..." },
    ],
    render: () => eventInvite(),
  }),
  broadcast({
    key: "announcement",
    label: "Announcement (custom)",
    topic: "news",
    description: "A custom headline, message, and call to action.",
    fields: [
      { name: "subject", label: "Subject line", type: "text", required: true },
      { name: "preheader", label: "Preview text", type: "text", required: true },
      { name: "eyebrow", label: "Eyebrow / kicker", type: "text", required: true, placeholder: "Big news" },
      { name: "headline", label: "Headline", type: "text", required: true },
      { name: "subhead", label: "Subhead", type: "text", required: true },
      { name: "body", label: "Message", type: "textarea", required: true, rich: true, placeholder: "Your message. **Bold**, *italic*, [links](https://…) and - bullet lists welcome." },
      { name: "cta_label", label: "Button label", type: "text", required: true, placeholder: "Read more" },
      { name: "cta_url", label: "Button URL", type: "text", required: true, placeholder: "https://..." },
    ],
    render: () => announcement(),
  }),
];

export const getBroadcast = (key: string): BroadcastDef | undefined => BROADCASTS.find((b) => b.key === key);

// Lightweight metadata for the client composer (no build fns).
export const BROADCAST_META = BROADCASTS.map(({ key, label, topic, description, fields }) => ({ key, label, topic, description, fields }));
export type BroadcastMeta = (typeof BROADCAST_META)[number];
