// MO-02 county geography for the SMS vote agent (lib/sms/votebot.ts).
//
// Hand-maintained reference data compiled from candidate/absentee-voting-guide.md
// (county election-authority contacts verified 2026-07-03 against the official
// county sites; Franklin County added + verified 2026-07-10). This file reads
// NOTHING from the voter file — it is static campaign reference content, so the
// TCPA isolation guard (audiences.voterfile-isolation.test.ts) stays intact.

export type CountyKey = "st-louis" | "franklin" | "jefferson" | "washington" | "crawford" | "gasconade";

export type County = {
  key: CountyKey;
  name: string; // display name
  authority: string; // election authority
  office: string; // where to vote early in person (street, city)
  phoneLabel: string; // display phone for the authority
};

export const COUNTIES: Record<CountyKey, County> = {
  "st-louis": {
    key: "st-louis",
    name: "St. Louis County",
    authority: "St. Louis County Board of Elections",
    office: "725 Northwest Plaza Dr, St. Ann",
    phoneLabel: "314.615.1833",
  },
  franklin: {
    key: "franklin",
    name: "Franklin County",
    authority: "Franklin County Clerk",
    office: "400 E Locust, Room 201, Union",
    phoneLabel: "636.583.6355",
  },
  jefferson: {
    key: "jefferson",
    name: "Jefferson County",
    authority: "Jefferson County Clerk",
    office: "729 Maple St, Suite G17, Hillsboro",
    phoneLabel: "636.797.5486",
  },
  washington: {
    key: "washington",
    name: "Washington County",
    authority: "Washington County Clerk",
    office: "102 N Missouri St, Potosi",
    phoneLabel: "573.436.7704",
  },
  crawford: {
    key: "crawford",
    name: "Crawford County",
    authority: "Crawford County Clerk",
    office: "302 W Main St, #AS, Steelville",
    phoneLabel: "573.775.2376",
  },
  gasconade: {
    key: "gasconade",
    name: "Gasconade County",
    authority: "Gasconade County Clerk",
    office: "119 E First St, Suite 2, Hermann",
    phoneLabel: "573.486.5427",
  },
};

/** A county by its stored key (e.g. from a conversation row), or null. */
export function countyByKey(key: string | undefined | null): County | null {
  if (!key) return null;
  return (COUNTIES as Record<string, County>)[key] ?? null;
}

// Starter ZIP5 → county map. ONLY ZIPs whose county is verifiable from campaign
// reference material (the election-authority office addresses in
// candidate/absentee-voting-guide.md, the campaign's own St. Louis County
// addresses/turf). Deliberately NOT exhaustive — an unknown ZIP falls back to
// asking for the county name, which needs no crosswalk and can't be wrong.
// Extend via the sourced ZIP/school-district crosswalk task
// (candidate/sms-conversational-interface-plan.md §6); never guess an entry —
// several ZIPs cross county lines.
export const ZIP_TO_COUNTY: Record<string, CountyKey> = {
  // St. Louis County
  "63011": "st-louis", // Ballwin
  "63017": "st-louis", // Chesterfield
  "63074": "st-louis", // St. Ann (Board of Elections)
  "63122": "st-louis", // Kirkwood
  "63131": "st-louis", // campaign HQ area
  // County seats (election-authority offices)
  "63084": "franklin", // Union
  "63050": "jefferson", // Hillsboro
  "63664": "washington", // Potosi
  "65565": "crawford", // Steelville
  "65041": "gasconade", // Hermann
};

const alpha = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");

// County-name tokens matched against the normalized (letters-only) message.
// Note: the CITY of Washington, MO sits in Franklin County — a "WASHINGTON"
// reply is read as Washington COUNTY (the ask copy says "county", and the reply
// names the county seat, Potosi, so a mismatch is self-evident to the voter).
const NAME_TOKENS: ReadonlyArray<[string, CountyKey]> = [
  ["STLOUIS", "st-louis"],
  ["SAINTLOUIS", "st-louis"],
  ["FRANKLIN", "franklin"],
  ["JEFFERSON", "jefferson"],
  ["JEFFCO", "jefferson"],
  ["WASHINGTON", "washington"],
  ["CRAWFORD", "crawford"],
  ["GASCONADE", "gasconade"],
];

/** Match a texted county name ("Franklin", "st. louis", "STL") to an MO-02 county. */
export function matchCountyName(raw: string): County | null {
  const a = alpha(raw);
  if (!a) return null;
  if (a === "STL") return COUNTIES["st-louis"]; // exact-only: too short for contains
  const hit = NAME_TOKENS.find(([token]) => a.includes(token));
  return hit ? COUNTIES[hit[1]] : null;
}

/** Match a 5-digit ZIP anywhere in the message against the verified starter map. */
export function matchZip(raw: string): { zip: string; county: County } | null {
  const m = raw.match(/\b(\d{5})\b/);
  if (!m) return null;
  const key = ZIP_TO_COUNTY[m[1]];
  return key ? { zip: m[1], county: COUNTIES[key] } : null;
}
