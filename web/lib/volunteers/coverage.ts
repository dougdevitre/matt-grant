// Coverage map — the admin view of how captains cover MO-02's geographic regions.
// PURE and testable: buildCoverage() takes the canonical regions (Airtable Geo
// Hierarchy) + active captains and reports, per region, who covers it, the combined
// team size, and three honest flags an organizer acts on:
//   • gap      — no captain assigned (recruit/assign one)
//   • overlap  — more than one captain (clarify ownership or split turf)
//   • overSpan — combined team over the span-of-control max (split at 10)
// It also surfaces captains assigned to a region not in the hierarchy ("unknown")
// and captains with no region at all ("unassigned"), so nothing hides.
import type { Region } from "@/lib/volunteers/regions";
import type { Captain } from "@/lib/volunteers/captains";

// Span-of-control: a team small enough for real relationships (matches the captain
// guide / protocol). At/over the max, the region is flagged to split.
export const SPAN_MAX = 10;

export type CoverageCaptain = { email: string; firstName: string; teamSize: number };

export type CoverageRow = {
  region: Region;
  captains: CoverageCaptain[];
  captainCount: number;
  teamSize: number;
  gap: boolean; // no captain covers this region
  overlap: boolean; // more than one captain
  overSpan: boolean; // combined team at/over SPAN_MAX
};

export type CoverageReport = {
  rows: CoverageRow[];
  // Captains assigned to a region name that isn't in the Geo Hierarchy (typo /
  // stale name). { region name → captains }.
  unknownRegions: CoverageRow[];
  // Active captains with no region assigned at all (still counted toward totals).
  unassigned: CoverageCaptain[];
  totals: {
    regions: number;
    covered: number;
    gaps: number;
    overlaps: number;
    overSpan: number;
    captains: number;
    unassignedCaptains: number;
  };
};

const norm = (s: string) => s.trim().toLowerCase();
const toCov = (c: Captain): CoverageCaptain => ({ email: c.email, firstName: c.firstName, teamSize: c.teamSize });

/**
 * Build the coverage report. Deterministic: regions keep their incoming order;
 * captains within a region sort by team size (desc) then email. No Date/random.
 */
export function buildCoverage(regions: Region[], captains: Captain[]): CoverageReport {
  // Index captains by each normalized region name they cover.
  const byRegion = new Map<string, Captain[]>();
  const unassigned: CoverageCaptain[] = [];
  for (const c of captains) {
    const names = (c.regions ?? []).map((r) => r.trim()).filter(Boolean);
    if (!names.length) {
      unassigned.push(toCov(c));
      continue;
    }
    for (const name of names) {
      const key = norm(name);
      const list = byRegion.get(key) ?? [];
      list.push(c);
      byRegion.set(key, list);
    }
  }

  const sortCaps = (a: CoverageCaptain, b: CoverageCaptain) =>
    b.teamSize - a.teamSize || a.email.localeCompare(b.email);

  const mkRow = (region: Region, caps: Captain[]): CoverageRow => {
    const covs = caps.map(toCov).sort(sortCaps);
    const teamSize = covs.reduce((n, c) => n + c.teamSize, 0);
    return {
      region,
      captains: covs,
      captainCount: covs.length,
      teamSize,
      gap: covs.length === 0,
      overlap: covs.length > 1,
      overSpan: teamSize >= SPAN_MAX,
    };
  };

  const known = new Set<string>();
  const rows = regions.map((region) => {
    const key = norm(region.name);
    known.add(key);
    return mkRow(region, byRegion.get(key) ?? []);
  });

  // Region names captains claim that aren't in the hierarchy.
  const unknownRegions: CoverageRow[] = [];
  for (const [key, caps] of byRegion) {
    if (known.has(key)) continue;
    const name = caps[0].regions?.find((r) => norm(r) === key) ?? key;
    unknownRegions.push(mkRow({ name, level: "(unknown)", parent: null }, caps));
  }
  unknownRegions.sort((a, b) => a.region.name.localeCompare(b.region.name));

  const totals = {
    regions: rows.length,
    covered: rows.filter((r) => !r.gap).length,
    gaps: rows.filter((r) => r.gap).length,
    overlaps: rows.filter((r) => r.overlap).length,
    overSpan: rows.filter((r) => r.overSpan).length,
    captains: captains.length,
    unassignedCaptains: unassigned.length,
  };

  return { rows, unknownRegions, unassigned: unassigned.sort(sortCaps), totals };
}
