// Default run-of-show checklists per event type. When an event is created its
// checklist is seeded from the template for its type so a captain has a ready
// list to work through with volunteers; they can add/remove items afterward.
// These are operational defaults, not requirements — tune freely.

import type { EventType, EventChecklistItem } from "@/lib/events/types";

// Appended to every type — the universal day-of basics.
const BASELINE = [
  "Confirm date, time, and exact location with the organizer",
  "Arrive 30 minutes early to set up",
  "Bring signage, literature, and sign-up sheets",
  "Capture photos/video for social",
  "Debrief: log contacts made and follow-ups",
];

const BY_TYPE: Record<EventType, string[]> = {
  parade: [
    "Confirm lineup position and staging time",
    "Assign banner and sign carriers",
    "Load candy/handouts and water for walkers",
    "Line up a photographer along the route",
  ],
  rally: [
    "Confirm program and speaking slot",
    "Coordinate visibility (signs, shirts) with volunteers",
    "Set a crowd/turnout goal and invite list",
  ],
  "town-hall": [
    "Check AV / mic / projector at the venue",
    "Prepare talking points and likely Q&A",
    "Set up a sign-in sheet to capture attendees",
  ],
  debate: [
    "Confirm format, rules, and time limits",
    "Prep talking points and rebuttals",
    "Organize a supporter section / visibility",
  ],
  fundraiser: [
    "Confirm host, venue, and headcount",
    "Compliance: record every contribution (name, address, employer, occupation)",
    "Prepare the ask and a thank-you list",
  ],
  "meet-greet": [
    "Reserve the booth/table space",
    "Stock literature and a sign-up clipboard",
    "Schedule volunteer shifts to cover the hours",
  ],
  canvass: [
    "Cut the walk list / turf for the area",
    "Print walk packets and scripts",
    "Brief volunteers and pair them up",
  ],
  "volunteer-shift": [
    "Define the task and the goal for the shift",
    "Confirm volunteer count and roles",
  ],
  other: [],
};

// Build a fresh checklist (all unchecked) for an event type. Ids are unique
// within the event; custom items added later use their own generated ids.
export function defaultChecklistFor(type: EventType): EventChecklistItem[] {
  const texts = [...(BY_TYPE[type] ?? []), ...BASELINE];
  return texts.map((text, i) => ({ id: `tpl-${i}`, text, done: false }));
}

export const CHECKLIST_TEMPLATES = BY_TYPE;
