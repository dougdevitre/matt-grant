// Pure, client-safe event constants + types. No DB/AWS imports here so a "use
// client" component (the composer, lists) can import EVENT_TYPES / labels without
// bundling the server-only DynamoDB layer. lib/events.ts re-exports all of this.

export const EVENT_TYPES = [
  "rally", "town-hall", "fundraiser", "canvass", "parade", "meet-greet", "debate", "volunteer-shift", "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  rally: "Rally",
  "town-hall": "Town hall",
  fundraiser: "Fundraiser",
  canvass: "Canvass",
  parade: "Parade",
  "meet-greet": "Meet & greet",
  debate: "Debate / forum",
  "volunteer-shift": "Volunteer shift",
  other: "Other",
};

export function isEventType(v: unknown): v is EventType {
  return typeof v === "string" && (EVENT_TYPES as readonly string[]).includes(v);
}

export const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "CANCELLED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];
export const isEventStatus = (v: unknown): v is EventStatus =>
  typeof v === "string" && (EVENT_STATUSES as readonly string[]).includes(v);

export type EventLocation = { name: string; address: string; city: string; county: string };

// Outcome of the publish-time email + SMS broadcast, persisted on the event so the
// dashboard can show whether notifications actually went out (vs. a false "Published").
export type EventNotifyResult = {
  at: string;
  email: { queued: boolean; reason?: string };
  sms: { queued: boolean; reason?: string };
};

export type Signup = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  count: number;
  createdAt: string;
};

export type EventRow = {
  id: string;
  title: string;
  type: EventType;
  start: string; // ISO 8601
  end: string | null;
  allDay: boolean;
  location: EventLocation;
  districtKey: string;
  description: string;
  status: EventStatus;
  capacity: number | null;
  signups: Signup[];
  source: "manual" | "email";
  parseConfidence: number | null;
  notifiedEmailAt: string | null;
  notifiedSmsAt: string | null;
  notifyResult: EventNotifyResult | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
};

// Public-safe projection — strips signup PII and internal bookkeeping.
export type PublicEvent = {
  id: string;
  title: string;
  type: EventType;
  start: string;
  end: string | null;
  allDay: boolean;
  location: EventLocation;
  districtKey: string;
  description: string;
  capacity: number | null;
  signupCount: number;
  goingCount: number;
  createdAt: string;
};

export type EventInput = {
  title: string;
  type: EventType;
  start: string;
  end?: string | null;
  allDay?: boolean;
  location: EventLocation;
  description: string;
  capacity?: number | null;
  status?: EventStatus;
  source?: "manual" | "email";
  parseConfidence?: number | null;
  createdBy: string;
};

/** Remaining RSVP spots. A null capacity means unlimited → returns null. */
export function spotsLeft(capacity: number | null, goingCount: number): number | null {
  if (capacity == null) return null;
  return Math.max(0, capacity - goingCount);
}

/** True only when a capacity is set and it's reached/exceeded. */
export function isEventFull(capacity: number | null, goingCount: number): boolean {
  const left = spotsLeft(capacity, goingCount);
  return left != null && left <= 0;
}
