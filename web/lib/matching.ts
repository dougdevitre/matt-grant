// Volunteer↔task fit scoring. Combines the volunteer's interests, status, and
// current load with their structured profile (mode, skills, ZIP/city) when set.
// No external calls — deterministic and unit-testable. Powers the "Suggested"
// assignees on the task board.
import type { TaskRow, VolunteerRow } from "@/lib/queries";

// Task title/category/detail keywords → the public interest tags volunteers pick
// on the signup form ("Knock doors", "Make calls", "Host an event", "Yard sign",
// "Donate"). First match wins per interest.
const KEYWORD_INTEREST: Array<[RegExp, string]> = [
  [/door|canvass|knock|lit ?drop|literature|turf|precinct|walk/i, "Knock doors"],
  [/call|phone|dial|text|gotv|bank/i, "Make calls"],
  [/event|house ?party|host|town ?hall|table|tabling|forum|rally/i, "Host an event"],
  [/sign|yard/i, "Yard sign"],
  [/donat|fundrais|chip ?in|finance|treasur/i, "Donate"],
];

// Task keywords → a required skill. Values are the CANONICAL Airtable skill names
// (see lib/volunteer/taxonomy.ts) so they match the structured skills a /join
// signup stores on the volunteer record.
const KEYWORD_SKILL: Array<[RegExp, string]> = [
  [/driv|transport|\bride\b|deliver|haul/i, "Driving (license + vehicle)"],
  [/writ|letter|\bnote\b|caption|copy|op-?ed|editor/i, "Writing"],
  [/design|graphic|flyer|logo|canva/i, "Graphic / social design"],
  [/speak|forum|surrogate|present|emcee|debate/i, "Public speaking"],
  [/spanish|bilingual|translat/i, "Bilingual (Spanish)"],
  [/data|enter|crm|spreadsheet|votebuilder|minivan|dialer/i, "Tech / app use"],
  [/host|party|hospitality|greet|setup|clean ?up/i, "Hospitality / hosting"],
];

// Whether a task reads as in-person vs digital (for mode preference).
const IN_PERSON = /door|canvass|knock|sign|yard|event|host|town ?hall|table|parade|poll|rally|literature|turf|walk|deliver|drive|ride/i;
const DIGITAL = /call|phone|\btext\b|social|post|email|donat|graphic|caption|data ?entry|dialer|crm|share|remote/i;

type TaskLike = Pick<TaskRow, "title" | "category" | "detail">;

/** Interests a task implies, inferred from its title/category/detail. */
export function taskInterests(task: TaskLike): string[] {
  const hay = `${task.title} ${task.detail ?? ""} ${task.category}`;
  const out = new Set<string>();
  for (const [re, interest] of KEYWORD_INTEREST) if (re.test(hay)) out.add(interest);
  return [...out];
}

/** Skills a task implies (matched against the volunteer's skills). */
export function taskSkills(task: TaskLike): string[] {
  const hay = `${task.title} ${task.detail ?? ""} ${task.category}`;
  const out = new Set<string>();
  for (const [re, skill] of KEYWORD_SKILL) if (re.test(hay)) out.add(skill);
  return [...out];
}

/** "In-person" | "Digital" | null — null when ambiguous (both or neither). */
export function taskMode(task: TaskLike): "In-person" | "Digital" | null {
  const hay = `${task.title} ${task.detail ?? ""} ${task.category}`;
  const inP = IN_PERSON.test(hay);
  const dig = DIGITAL.test(hay);
  if (inP === dig) return null;
  return inP ? "In-person" : "Digital";
}

export type Fit = { score: number; reasons: string[] };

function volunteerTags(v: VolunteerRow): string[] {
  if (v.interestTags?.length) return v.interestTags;
  return v.interests ? v.interests.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
}

/** Score one volunteer for one task. Higher = better fit. `load` = their current task count. */
export function scoreVolunteer(task: TaskLike, v: VolunteerRow, load = 0): Fit {
  const reasons: string[] = [];
  let score = 0;

  // Interest match — the strongest signal.
  const wanted = taskInterests(task);
  const tags = volunteerTags(v);
  const matched = wanted.filter((w) => tags.some((t) => t.toLowerCase() === w.toLowerCase()));
  if (matched.length) {
    score += 50 * matched.length;
    reasons.push(`interest: ${matched.join(", ")}`);
  }

  // Engagement — surface people already in motion.
  if (v.status === "ACTIVE") {
    score += 20;
    reasons.push("active");
  } else if (v.status === "CONTACTED") {
    score += 5;
  } else if (v.status === "INACTIVE") {
    score -= 25;
  }

  // Load-balance — spread work, don't pile it on the same few.
  if (load > 0) {
    score -= Math.min(load, 6) * 8;
    reasons.push(`${load} task${load === 1 ? "" : "s"} already`);
  }

  // Mode preference (digital vs in-person), when the task reads clearly and the
  // volunteer stated a preference.
  const tMode = taskMode(task);
  if (tMode && v.mode) {
    if (v.mode === "Either" || v.mode === tMode) {
      score += 15;
      reasons.push(`mode: ${tMode.toLowerCase()}`);
    } else {
      score -= 12;
    }
  }

  // Skill match (structured profile).
  const need = taskSkills(task);
  const have = v.skills ?? [];
  const matchedSkills = need.filter((s) => have.includes(s));
  if (matchedSkills.length) {
    score += 25 * matchedSkills.length;
    reasons.push(`skill: ${matchedSkills.join(", ")}`);
  }

  // Geography — a light nudge when the task names the volunteer's ZIP/city.
  const geoHay = `${task.title} ${task.detail ?? ""}`.toLowerCase();
  if (v.zip && geoHay.includes(v.zip)) {
    score += 12;
    reasons.push("local (ZIP)");
  } else if (v.city && v.city.length > 2 && geoHay.includes(v.city.toLowerCase())) {
    score += 8;
    reasons.push(`local: ${v.city}`);
  }

  return { score, reasons };
}

export type Suggestion = { v: VolunteerRow; fit: Fit };

/** Top-N best-fit volunteers for a task (score > 0), best first. */
export function suggestVolunteers(
  task: TaskLike,
  volunteers: VolunteerRow[],
  loads: Record<string, number> = {},
  limit = 3,
): Suggestion[] {
  return volunteers
    .map((v) => ({ v, fit: scoreVolunteer(task, v, loads[v.id] ?? 0) }))
    .filter((s) => s.fit.score > 0)
    .sort((a, b) => b.fit.score - a.fit.score)
    .slice(0, limit);
}
