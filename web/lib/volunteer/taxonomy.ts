// Canonical volunteer taxonomy — the single source of truth shared by the public
// /join signup form, the volunteer↔task matcher, and the Airtable mirror.
//
// Every NAME here MUST match the corresponding record/option name in the
// "Volunteer Engagement" Airtable base (appAmtan3qWZE7iGR) exactly, because the
// mirror links a signup to the Roles / Skills / Commitment Levels tables BY NAME
// (resolved to record ids in lib/volunteers/airtable.ts). Keep this file in sync
// with those tables — it is the website's mirror of that no-code vocabulary, so a
// new signup is tagged in the same language the Task Templates use, and captains
// can staff turf / lists / events from real people.
//
// Client-safe: no server-only imports, so the form components import it directly.

// ── The four public "doors" (the /join menu) ─────────────────────────────────
export const JOIN_DOORS = ["Get Updates", "Volunteer", "Donor Pledge", "Team Captain"] as const;
export type JoinDoor = (typeof JOIN_DOORS)[number];
const DOOR_SET = new Set<string>(JOIN_DOORS);
export const isJoinDoor = (v: unknown): v is JoinDoor => typeof v === "string" && DOOR_SET.has(v);

// ── Commitment Levels — Airtable table tblCwHWNyFkCbtmEr ──────────────────────
// One per volunteer (how much time they can give). "Core" is the captain pipeline.
export type CommitmentLevel = {
  name: string; // EXACT Airtable record name (primary field) — used to link
  hours: string; // display only
  blurb: string;
};
export const COMMITMENT_LEVELS: CommitmentLevel[] = [
  { name: "One-time", hours: "1–2 hours", blurb: "A single event or shift. Lowest barrier — perfect for a first time." },
  { name: "Regular", hours: "3–5 hrs/week", blurb: "Recurring weekly shifts through the campaign." },
  { name: "Core", hours: "5+ hrs/week", blurb: "Committed core volunteer — the path to becoming a captain." },
  { name: "Election-Day only", hours: "Election Day", blurb: "GOTV-only: polls, rides, knock-and-drag, greeting." },
  { name: "Ongoing relationship", hours: "1–2 hrs/week", blurb: "Sustained relational work: surrogate, coalition liaison, adopt-a-block." },
];
const COMMITMENT_SET = new Set<string>(COMMITMENT_LEVELS.map((c) => c.name));
export const isCommitmentLevel = (v: unknown): v is string => typeof v === "string" && COMMITMENT_SET.has(v);

// ── Participation Mode — mirrors Task Templates' Participation Mode ────────────
export const VOLUNTEER_MODES = ["Digital", "In-person", "Either"] as const;
export type VolunteerMode = (typeof VOLUNTEER_MODES)[number];
const MODE_SET = new Set<string>(VOLUNTEER_MODES);
export const isVolunteerMode = (v: unknown): v is VolunteerMode => typeof v === "string" && MODE_SET.has(v);

// ── Availability — mirrors Task Templates' Availability multi-select ───────────
export const VOLUNTEER_AVAILABILITY = [
  "Weekday daytime",
  "Weekday evening",
  "Weekend",
  "Election Day",
] as const;
export type VolunteerAvailability = (typeof VOLUNTEER_AVAILABILITY)[number];
const AVAIL_SET = new Set<string>(VOLUNTEER_AVAILABILITY);
export const isAvailability = (v: unknown): v is VolunteerAvailability => typeof v === "string" && AVAIL_SET.has(v);

// ── Skills — Airtable table tbl8X1KtyD2NmTp3s ─────────────────────────────────
// `name` is the EXACT Airtable record name (used to link); `label` is the shorter
// form shown on the public form. The matcher (lib/matching.ts) keys on `name`.
export type VolunteerSkill = { name: string; label: string };
export const VOLUNTEER_SKILLS: VolunteerSkill[] = [
  { name: "Driving (license + vehicle)", label: "Driving" },
  { name: "Writing", label: "Writing" },
  { name: "Public speaking", label: "Public speaking" },
  { name: "Bilingual (Spanish)", label: "Bilingual (Spanish)" },
  { name: "Tech / app use", label: "Tech" },
  { name: "Hospitality / hosting", label: "Hospitality" },
  { name: "Leadership / team management", label: "Leadership" },
  { name: "Phone communication", label: "Phone communication" },
  { name: "Comfortable with strangers", label: "Comfortable with strangers" },
  { name: "Physical ability", label: "Physical ability" },
  { name: "Legal awareness", label: "Legal awareness" },
  { name: "Graphic / social design", label: "Design" },
  { name: "Detail-oriented / data accuracy", label: "Detail-oriented" },
  { name: "Community credibility / network", label: "Community credibility" },
];
const SKILL_SET = new Set<string>(VOLUNTEER_SKILLS.map((s) => s.name));
export const isVolunteerSkill = (v: unknown): v is string => typeof v === "string" && SKILL_SET.has(v);

// ── Roles — Airtable table tbl3JQ5qSEKRKEZbx (NOT the RBAC roles) ──────────────
// Volunteer roles a person can express interest in, grouped by Role Category for
// the form. `name` is the EXACT Airtable record name (used to link).
export type VolunteerRoleCategory =
  | "Field / Canvass"
  | "Phone / Digital"
  | "Events"
  | "Election Day"
  | "Leadership"
  | "Surrogate / Coalition"
  | "Data / Office"
  | "Finance";

export type VolunteerRole = { name: string; category: VolunteerRoleCategory; blurb: string };
export const VOLUNTEER_ROLES: VolunteerRole[] = [
  { name: "Canvasser", category: "Field / Canvass", blurb: "Door-to-door voter contact." },
  { name: "Driver", category: "Field / Canvass", blurb: "Transport volunteers or voters; license + vehicle." },
  { name: "Yard Sign Crew", category: "Field / Canvass", blurb: "Deliver and place yard signs." },
  { name: "Relational Organizer", category: "Phone / Digital", blurb: "Reach 5–10 people in your own network. Highest ROI." },
  { name: "Phone Banker", category: "Phone / Digital", blurb: "Telephone voter contact; flexible shifts." },
  { name: "Text Banker", category: "Phone / Digital", blurb: "Peer-to-peer texting; remote-friendly." },
  { name: "Social Media Ambassador", category: "Phone / Digital", blurb: "Create or share campaign content; fully remote." },
  { name: "House Party Host", category: "Events", blurb: "Host a campaign event at home." },
  { name: "Event Volunteer", category: "Events", blurb: "Setup, greeting, sign-in, logistics at events." },
  { name: "Poll Watcher", category: "Election Day", blurb: "Observe voting; document irregularities. Training required." },
  { name: "Poll Greeter", category: "Election Day", blurb: "Greet friendly voters outside polls on Election Day." },
  { name: "Ride-to-Polls Driver", category: "Election Day", blurb: "Drive supporters to the polls on Election Day." },
  { name: "Volunteer Captain", category: "Leadership", blurb: "Lead a team of 5–10 volunteers: train, schedule, debrief." },
  { name: "Coalition Liaison", category: "Surrogate / Coalition", blurb: "Trusted messenger to a voter group." },
  { name: "Surrogate", category: "Surrogate / Coalition", blurb: "Speak or endorse on the campaign's behalf." },
  { name: "Office Volunteer", category: "Data / Office", blurb: "Administrative tasks, mailings, packet prep." },
  { name: "Letter Writer", category: "Data / Office", blurb: "Letters to the editor and handwritten voter notes." },
  { name: "Data Entry", category: "Data / Office", blurb: "Enter canvass and donor data into the CRM." },
  { name: "Fundraising Volunteer", category: "Finance", blurb: "Event setup, donation collection, donor thank-yous." },
];
const ROLE_SET = new Set<string>(VOLUNTEER_ROLES.map((r) => r.name));
export const isVolunteerRole = (v: unknown): v is string => typeof v === "string" && ROLE_SET.has(v);

// Form-friendly grouping: roles bucketed by category, in display order.
export const ROLE_CATEGORY_ORDER: VolunteerRoleCategory[] = [
  "Field / Canvass",
  "Phone / Digital",
  "Events",
  "Election Day",
  "Data / Office",
  "Surrogate / Coalition",
  "Finance",
  "Leadership",
];
export const ROLES_BY_CATEGORY: Record<VolunteerRoleCategory, VolunteerRole[]> = ROLE_CATEGORY_ORDER.reduce(
  (acc, cat) => {
    acc[cat] = VOLUNTEER_ROLES.filter((r) => r.category === cat);
    return acc;
  },
  {} as Record<VolunteerRoleCategory, VolunteerRole[]>,
);

// All linkable lookup table ids, for the mirror's name→record-id resolver.
export const VOLUNTEER_LINK_TABLES = {
  commitmentLevels: "tblCwHWNyFkCbtmEr",
  roles: "tbl3JQ5qSEKRKEZbx",
  skills: "tbl8X1KtyD2NmTp3s",
} as const;
