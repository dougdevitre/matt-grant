// Lightweight volunteer↔task fit scoring from the data we already have today:
// the volunteer's stated interests, status, and current task load. No schema
// change, no external calls — deterministic and unit-testable. Powers the
// "Suggested" assignees on the task board. As volunteer records gain structured
// skill/availability/ZIP (the Airtable taxonomy), extend scoreVolunteer here.
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

type TaskLike = Pick<TaskRow, "title" | "category" | "detail">;

/** Interests a task implies, inferred from its title/category/detail. */
export function taskInterests(task: TaskLike): string[] {
  const hay = `${task.title} ${task.detail ?? ""} ${task.category}`;
  const out = new Set<string>();
  for (const [re, interest] of KEYWORD_INTEREST) if (re.test(hay)) out.add(interest);
  return [...out];
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
