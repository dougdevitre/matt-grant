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

// Internal event staffing — the captain who owns the appearance and the volunteer
// roster assigned to work it. Distinct from public `signups` (RSVPs). `id` is a
// volunteer record id (or a staff email for the captain); `name` is denormalized
// so the dashboard renders without a join, mirroring task assignment.
export type EventStaffer = { id: string; name: string };

// Priority tier for deciding where to appear (rubric + helpers in ./priority).
export type EventPriority = 1 | 2 | 3;

// One item on a captain's run-of-show checklist. May be assigned to a roster
// volunteer; `doneBy`/`doneAt` record who checked it and when.
export type EventChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  assigneeId?: string;
  assigneeName?: string;
  doneBy?: string;
  doneAt?: string;
};

export type EventRow = {
  id: string;
  title: string;
  type: EventType;
  start: string; // ISO 8601
  end: string | null;
  allDay: boolean;
  location: EventLocation;
  lat: number | null;
  lng: number | null;
  districtKey: string;
  description: string;
  status: EventStatus;
  capacity: number | null;
  priority: EventPriority;
  priorityManual: boolean;
  checklist: EventChecklistItem[];
  signups: Signup[];
  captain: EventStaffer | null;
  volunteers: EventStaffer[];
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
  lat?: number | null;
  lng?: number | null;
  description: string;
  capacity?: number | null;
  priority?: EventPriority;
  priorityManual?: boolean;
  checklist?: EventChecklistItem[];
  captain?: EventStaffer | null;
  volunteers?: EventStaffer[];
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
