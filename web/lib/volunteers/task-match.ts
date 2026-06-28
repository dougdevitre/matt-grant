// Volunteer-facing task matching — the last hop that turns a /join signup into
// action. Reads the Airtable Task Templates that are Active + visible to the
// community (Supporter / Volunteer), resolves their linked Role/Skill/Commitment
// records to names, and scores each against a volunteer's own profile so the
// community hub can show "here's what you can do" tailored to them.
//
// Two layers, kept apart so the scorer is pure + unit-testable:
//   • listMatchableTasks() — server-only Airtable read (id→name resolution, caching)
//   • matchTasks()         — pure, name-based ranking (no Airtable)
import "server-only";
import { listRecords } from "@/lib/airtable/client";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";

const BASE = AIRTABLE_BASES.volunteer;
const T = BASE.tables;

// "Visible To" values that the public community hub may surface.
const COMMUNITY_AUDIENCES = new Set(["Supporter", "Volunteer/Member"]);

export type MatchableTask = {
  id: string;
  name: string;
  whatTheyDo: string;
  roles: string[]; // resolved Role names
  skills: string[]; // resolved Skill names
  commitment: string[]; // resolved Commitment Level names
  mode: string; // Participation Mode (Digital / In-person / Either)
  availability: string[]; // Availability options
  geo: string; // Geo Scope
  priority: string; // High / Medium / Low
  effort: string; // e.g. "2-4 hr shift"
  channel: string[];
};

const toArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);

// ── id→name resolver for the linked lookup tables (cached; tables are tiny/static) ──
type Lookup = { tableId: string; primary: string };
const LOOKUPS: Record<"roles" | "skills" | "commitment", Lookup> = {
  roles: { tableId: T.roles, primary: "Name" },
  skills: { tableId: T.skills, primary: "Skill" },
  commitment: { tableId: T.commitmentLevels, primary: "Level" },
};
const TTL_MS = Number(process.env.AIRTABLE_LINK_TTL_MS) || 3_600_000;
type CacheEntry = { map: Map<string, string>; expires: number };
const idNameCache = new Map<string, CacheEntry>();

async function idToName(l: Lookup): Promise<Map<string, string>> {
  const hit = idNameCache.get(l.tableId);
  if (hit && hit.expires > Date.now()) return hit.map;
  const map = new Map<string, string>();
  try {
    for (const r of await listRecords(BASE.id, l.tableId, { fields: [l.primary], revalidate: 3600 })) {
      const n = r.fields[l.primary];
      if (typeof n === "string" && n.trim()) map.set(r.id, n);
    }
  } catch {
    /* leave empty — names just won't resolve, matching degrades, never throws */
  }
  idNameCache.set(l.tableId, { map, expires: Date.now() + TTL_MS });
  return map;
}

const namesFor = (ids: string[], m: Map<string, string>): string[] =>
  ids.map((id) => m.get(id)).filter((n): n is string => Boolean(n));

/**
 * Active task templates visible to the community, with links resolved to names.
 * Returns [] when Airtable is unconfigured or nothing is Active yet (graceful
 * empty state — the campaign curates templates Draft→Active over time).
 */
export async function listMatchableTasks(): Promise<MatchableTask[]> {
  let records;
  try {
    records = await listRecords(BASE.id, T.taskTemplates, { pageSize: 100, revalidate: 900 });
  } catch {
    return [];
  }
  if (!records.length) return [];

  const [roleMap, skillMap, commitMap] = await Promise.all([
    idToName(LOOKUPS.roles),
    idToName(LOOKUPS.skills),
    idToName(LOOKUPS.commitment),
  ]);

  const out: MatchableTask[] = [];
  for (const rec of records) {
    const f = rec.fields;
    const name = String(f["Task Name"] ?? "").trim();
    if (!name) continue;
    if (String(f["Status"] ?? "") !== "Active") continue; // only live tasks
    const visibleTo = toArr(f["Visible To"]);
    if (!visibleTo.some((v) => COMMUNITY_AUDIENCES.has(v))) continue; // community-safe only
    out.push({
      id: rec.id,
      name,
      whatTheyDo: String(f["What They Do"] ?? "").trim(),
      roles: namesFor(toArr(f["Role"]), roleMap),
      skills: namesFor(toArr(f["Skills"]), skillMap),
      commitment: namesFor(toArr(f["Commitment"]), commitMap),
      mode: String(f["Participation Mode"] ?? "").trim(),
      availability: toArr(f["Availability"]),
      geo: String(f["Geo Scope"] ?? "").trim(),
      priority: String(f["Priority"] ?? "").trim(),
      effort: String(f["Effort"] ?? "").trim(),
      channel: toArr(f["Channel"]),
    });
  }
  return out;
}

// ── Pure matcher ──────────────────────────────────────────────────────────────
export type MatchProfile = {
  roles?: string[];
  skills?: string[];
  commitment?: string | null;
  mode?: string | null; // Digital / In-person / Either
  availability?: string[];
};

export type TaskMatch = { task: MatchableTask; score: number; reasons: string[] };

const ANYTIME = /anytime|remote/i;
const lc = (s: string) => s.trim().toLowerCase();
const overlap = (a: string[], b: string[]): string[] => {
  const set = new Set(b.map(lc));
  return a.filter((x) => set.has(lc(x)));
};

/** True when a Digital-only volunteer is offered an In-person-only task (or vice-versa). */
function modeConflict(profileMode: string, taskMode: string): boolean {
  if (!profileMode || !taskMode) return false;
  if (profileMode === "Either" || taskMode === "Either") return false;
  return profileMode !== taskMode;
}

/**
 * Rank community tasks for one volunteer's profile, best first. Hard-excludes a
 * mode conflict; otherwise every visible task keeps a small base score so even a
 * thin (just-signed-up) profile still sees relevant supporter actions.
 */
export function matchTasks(profile: MatchProfile, tasks: MatchableTask[], limit = 6): TaskMatch[] {
  const pRoles = profile.roles ?? [];
  const pSkills = profile.skills ?? [];
  const pMode = profile.mode ?? "";
  const pAvail = profile.availability ?? [];

  const ranked: TaskMatch[] = [];
  for (const task of tasks) {
    if (modeConflict(pMode, task.mode)) continue;
    const reasons: string[] = [];
    let score = 5; // base — keep thin profiles from seeing an empty list

    const roleHits = overlap(pRoles, task.roles);
    if (roleHits.length) {
      score += Math.min(roleHits.length, 2) * 40;
      reasons.push(roleHits.join(", "));
    }
    const skillHits = overlap(pSkills, task.skills);
    if (skillHits.length) {
      score += Math.min(skillHits.length, 3) * 12;
      reasons.push(skillHits.join(", "));
    }
    if (profile.commitment && task.commitment.some((c) => lc(c) === lc(profile.commitment!))) {
      score += 15;
    }
    if (pMode && (task.mode === "Either" || task.mode === pMode)) score += 15;
    if (task.availability.some((a) => ANYTIME.test(a)) || overlap(pAvail, task.availability).length) {
      score += 12;
    }
    const pr = lc(task.priority);
    if (pr === "high") score += 8;
    else if (pr === "medium") score += 4;

    ranked.push({ task, score, reasons });
  }
  return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
}
