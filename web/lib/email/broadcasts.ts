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
};
export type BroadcastDef = {
  key: string;
  label: string;
  topic: TopicKey;
  description: string;
  fields: BroadcastField[];
  build: (vars: Record<string, string>) => Email;
};

const fill = (s: string, v: Record<string, string>) =>
  s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in v && v[k] ? v[k] : m));
const filled = (e: Email, v: Record<string, string>): Email => ({
  subject: fill(e.subject, v),
  html: fill(e.html, v),
  text: fill(e.text, v),
});

export const BROADCASTS: BroadcastDef[] = [
  {
    key: "newsletter",
    label: "Campaign newsletter",
    topic: "news",
    description: "The Four Priorities overview + a get-involved CTA. No inputs.",
    fields: [],
    build: (v) => filled(campaignNewsletter(), v),
  },
  {
    key: "issue",
    label: "Issue spotlight",
    topic: "issues",
    description: "A deep-dive on one of the four issues.",
    fields: [
      { name: "slug", label: "Issue", type: "select", required: true, options: ISSUES.map((i) => ({ value: i.slug, label: i.title })) },
    ],
    build: (v) => filled(issueSpotlight(v.slug || ISSUES[0].slug), v),
  },
  {
    key: "gotv",
    label: "GOTV reminder",
    topic: "gotv",
    description: "Make-a-plan-to-vote reminder for the final stretch.",
    fields: [
      { name: "daysOut", label: "Days until election", type: "number", required: true, placeholder: "7" },
      { name: "polling_place_url", label: "Polling-place lookup URL", type: "text", required: true, placeholder: "https://www.sos.mo.gov/..." },
    ],
    build: (v) => filled(gotvReminder(Number(v.daysOut) || 7), v),
  },
  {
    key: "fundraising",
    label: "Fundraising appeal",
    topic: "fundraising",
    description: "Final-stretch donate ask. No inputs.",
    fields: [],
    build: (v) => filled(fundraisingAppeal(), v),
  },
  {
    key: "event",
    label: "Event invite",
    topic: "events",
    description: "Invite the list to a campaign event.",
    fields: [
      { name: "event_title", label: "Event title", type: "text", required: true },
      { name: "event_date", label: "Date & time", type: "text", required: true, placeholder: "Saturday, July 12 · 6:00 PM" },
      { name: "event_location", label: "Location", type: "text", required: true },
      { name: "event_details", label: "Details", type: "textarea", required: true },
      { name: "rsvp_url", label: "RSVP URL", type: "text", required: true, placeholder: "https://..." },
      { name: "calendar_url", label: "Add-to-calendar URL", type: "text", required: true, placeholder: "https://..." },
    ],
    build: (v) => filled(eventInvite(), v),
  },
  {
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
      { name: "body", label: "Message", type: "textarea", required: true },
      { name: "cta_label", label: "Button label", type: "text", required: true, placeholder: "Read more" },
      { name: "cta_url", label: "Button URL", type: "text", required: true, placeholder: "https://..." },
    ],
    build: (v) => filled(announcement(), v),
  },
];

export const getBroadcast = (key: string): BroadcastDef | undefined => BROADCASTS.find((b) => b.key === key);

// Lightweight metadata for the client composer (no build fns).
export const BROADCAST_META = BROADCASTS.map(({ key, label, topic, description, fields }) => ({ key, label, topic, description, fields }));
export type BroadcastMeta = (typeof BROADCAST_META)[number];
