// Client-safe subscriber constants + types. Split out of lib/subscribers.ts (which
// imports node:crypto for unsubscribe tokens and can't be bundled into a client
// component). The dashboard SubscriberTable + its table config import from here;
// lib/subscribers.ts re-exports all of these so server callers are unchanged.

// Subscriber-facing broadcast topics. A subscriber can opt out of any subset
// (per-topic) or unsubscribe globally. Keys are stable; labels are shown on the
// preference center and map 1:1 to broadcast templates.
export const TOPICS = [
  { key: "news", label: "Campaign news & updates" },
  { key: "issues", label: "The issues & where Matt stands" },
  { key: "gotv", label: "Voting & election reminders" },
  { key: "fundraising", label: "Fundraising appeals" },
  { key: "events", label: "Event invitations" },
] as const;
export type TopicKey = (typeof TOPICS)[number]["key"];
export const TOPIC_KEYS = new Set<string>(TOPICS.map((t) => t.key));
export const isTopic = (v: unknown): v is TopicKey => typeof v === "string" && TOPIC_KEYS.has(v);

export type SuppressStatus = "unsubscribed" | "bounced" | "complained";
export type Preferences = { status: string; optOut: TopicKey[] };
export type SubscriberRow = { email: string; status: string; optOut: TopicKey[]; updatedAt?: string };
