// County-level turnout for MO-02 counties that have NO precinct-turnout feed
// (Franklin, Jefferson, Washington, Crawford, Gasconade — Franklin added
// 2026-07-10 per the voter-file census, candidate/voter-file-plan.md §5). The SOS statewide returns PDF
// does not contain county turnout, so these must be read from the SOS Election
// Night Reporting per-county view and entered here BY HAND, with the source URL.
//
// VERIFIED DATA ONLY. Leave an entry out (or commented) until you have the real
// number — empty entries render as flat boundaries with no shading, never a guess.
//
// turnoutPct = ballots cast / registered voters for that county, Aug 6 2024 primary.
// SOS results: https://www.sos.mo.gov/elections/resultsandstats/previouselections
// (pick "August 6, 2024 Primary" → county-level turnout / registered voters)

export type CountyTurnout = {
  registered: number;
  ballots: number;
  turnoutPct: number;
  asOf: string;
  sourceUrl: string;
};

export const COUNTY_TURNOUT: Record<string, CountyTurnout> = {
  // EXAMPLE (replace with verified numbers, then uncomment):
  // Jefferson: { registered: 0, ballots: 0, turnoutPct: 0, asOf: "Aug 6 2024 primary", sourceUrl: "https://..." },
  // Washington: { ... },
  // Crawford: { ... },
  // Gasconade: { ... },
};

export function turnoutFor(county: string): number | null {
  const c = COUNTY_TURNOUT[county];
  return c ? c.turnoutPct : null;
}
