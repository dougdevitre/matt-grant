// Captain teams — the data + matching behind "volunteers join a team captain".
// listActiveCaptains() reads the staff roster (active captains) with their coverage
// area and current team size; suggestCaptain() is a PURE, testable ranker that
// auto-matches a volunteer to the best captain (area first, then least-loaded so
// teams stay balanced). Kept together; the reader is server-only, the matcher pure.
import "server-only";
import { listStaff } from "@/lib/staff";
import { getVolunteers } from "@/lib/queries";

export type Captain = {
  email: string;
  name?: string;
  firstName: string; // public-safe display (no email)
  area?: string; // ZIP / city / county / label (legacy free-text)
  regions?: string[]; // canonical Geo Hierarchy region names (preferred)
  teamSize: number;
};

const firstNameOf = (name?: string): string => name?.trim().split(/\s+/)[0] || "your team lead";

/** Active team captains with coverage area + current team size. [] when DB/Clerk off. */
export async function listActiveCaptains(): Promise<Captain[]> {
  try {
    const [staff, vols] = await Promise.all([listStaff(), getVolunteers()]);
    const counts: Record<string, number> = {};
    for (const v of vols.rows) {
      const c = v.captainEmail?.toLowerCase();
      if (c) counts[c] = (counts[c] ?? 0) + 1;
    }
    return staff
      .filter((s) => s.status === "active" && s.role === "captain")
      .map((s) => {
        const email = s.email.toLowerCase();
        return { email, name: s.name, firstName: firstNameOf(s.name), area: s.area, regions: s.regions, teamSize: counts[email] ?? 0 };
      });
  } catch {
    return [];
  }
}

// ── Pure matcher ────────────────────────────────────────────────────────────
export type MatchableVolunteer = { zip?: string | null; city?: string | null };

const lc = (s: string) => s.trim().toLowerCase();

/** True when a single coverage label covers the volunteer's ZIP or city (loose, case-insensitive). */
function labelCovers(label: string | undefined, v: MatchableVolunteer): boolean {
  const a = label ? lc(label) : "";
  if (!a) return false;
  const zip = (v.zip ?? "").trim();
  const city = (v.city ?? "").trim();
  if (zip && (a.includes(zip) || zip.includes(a))) return true;
  if (city && a.includes(lc(city))) return true;
  return false;
}

/** True when a captain's area covers the volunteer's ZIP or city (loose, case-insensitive). */
export function areaCovers(area: string | undefined, v: MatchableVolunteer): boolean {
  return labelCovers(area, v);
}

/** True when any of a captain's assigned regions covers the volunteer. */
export function regionsCover(regions: string[] | undefined, v: MatchableVolunteer): boolean {
  return (regions ?? []).some((r) => labelCovers(r, v));
}

/** True when a captain covers the volunteer via assigned regions (preferred) or legacy area. */
export function captainCovers(c: Pick<Captain, "area" | "regions">, v: MatchableVolunteer): boolean {
  return regionsCover(c.regions, v) || areaCovers(c.area, v);
}

/**
 * Best captain for a volunteer: an area match wins; within the same tier the
 * least-loaded captain wins so teams stay balanced. Returns null when there are no
 * captains. Deterministic (ties break by email) — no Date/random.
 */
export function suggestCaptain(v: MatchableVolunteer, captains: Captain[]): Captain | null {
  if (!captains.length) return null;
  const ranked = [...captains].sort((a, b) => {
    const am = captainCovers(a, v) ? 1 : 0;
    const bm = captainCovers(b, v) ? 1 : 0;
    if (am !== bm) return bm - am; // coverage match first (regions preferred, area fallback)
    if (a.teamSize !== b.teamSize) return a.teamSize - b.teamSize; // then least-loaded
    return a.email.localeCompare(b.email); // stable tiebreak
  });
  return ranked[0];
}
