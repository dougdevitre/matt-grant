import { describe, it, expect } from "vitest";
import { COUNTY_TURNOUT, turnoutFor } from "./countyTurnout";

// The five MO-02 counties with no precinct-turnout feed (Franklin added
// 2026-07-10 per the voter-file census). Keys MUST be the bare county name
// (no " County" suffix) — that's what /api/geo/jefferson and
// /api/geo/extra-counties pass to turnoutFor(). See the file header.
const KNOWN = new Set(["Franklin", "Jefferson", "Washington", "Crawford", "Gasconade"]);

describe("COUNTY_TURNOUT", () => {
  // Guards any entered data — the map reads turnoutPct as a whole-number percent
  // (0–100), so a 0–1 fraction or a ballots>registered typo must fail here, not
  // silently mis-shade the map. Passes trivially while the record is empty.
  it("each entry is internally consistent and uses a bare county key", () => {
    for (const [county, c] of Object.entries(COUNTY_TURNOUT)) {
      expect(county, `${county}: key must be a bare name, no " County" suffix`).not.toMatch(/ County$/);
      expect(KNOWN.has(county), `${county}: unexpected county key`).toBe(true);
      expect(c.registered, `${county}.registered > 0`).toBeGreaterThan(0);
      expect(c.ballots, `${county}.ballots >= 0`).toBeGreaterThanOrEqual(0);
      expect(c.ballots, `${county}.ballots <= registered`).toBeLessThanOrEqual(c.registered);
      expect(c.turnoutPct, `${county}.turnoutPct >= 0`).toBeGreaterThanOrEqual(0);
      expect(c.turnoutPct, `${county}.turnoutPct <= 100 (whole-number percent)`).toBeLessThanOrEqual(100);
      // turnoutPct must be DERIVED from the entered ballots/registered, not typed
      // separately — a hand-typo in any of the three fields fails here.
      expect(c.turnoutPct, `${county}.turnoutPct = round(100·ballots/registered)`).toBe(
        Math.round((100 * c.ballots) / c.registered),
      );
      expect(c.sourceUrl, `${county}.sourceUrl must be an https URL`).toMatch(/^https:\/\//);
      expect(c.asOf.length, `${county}.asOf non-empty`).toBeGreaterThan(0);
    }
  });

  it("turnoutFor returns null for an unlisted county", () => {
    expect(turnoutFor("Nonexistent")).toBeNull();
  });
});
