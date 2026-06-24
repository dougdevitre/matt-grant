// Curated catalog of recurring MO-02 appearance opportunities an admin can turn
// into a draft event in one click. This is LOGISTICAL public-event data — a
// shortlist of places a campaign might consider appearing — NOT a schedule, an
// endorsement, or a claim that the campaign is attending or invited.
//
// COMPLIANCE: every entry carries a source link and a `verifiedAt` date. Annual
// dates shift year to year, so each is a TYPICAL window to confirm with the
// organizer — never treat the timing here as authoritative. This list was hand-
// compiled from public sources; expand it (with citations) as the field firms up.
//
// Counties use the FIPS-backed labels the district resolver understands
// (St. Louis 189, Jefferson 099, Franklin 071, Washington 221). Type maps onto
// the existing EVENT_TYPES so "Add to calendar" produces a normal draft event.

import type { EventType, EventInput } from "@/lib/events/types";

export type AppearanceOpportunity = {
  slug: string;
  name: string;
  suggestedType: EventType;
  city: string;
  county: string; // human label (resolveDistrict normalizes by name)
  typicalWindow: string; // e.g. "Mid-July" — confirm exact dates with the organizer
  cadence: string; // e.g. "Annual"
  blurb: string; // why it's a fit
  sourceUrl: string;
  verifiedAt: string; // ISO date this entry was last checked against its source
};

const VERIFIED = "2026-06-24";

export const APPEARANCE_OPPORTUNITIES: AppearanceOpportunity[] = [
  {
    slug: "jefferson-county-fair",
    name: "Jefferson County Fair",
    suggestedType: "meet-greet",
    city: "Hillsboro",
    county: "Jefferson County",
    typicalWindow: "Mid-to-late July",
    cadence: "Annual (4-day fair)",
    blurb: "County-wide foot traffic — 4-H, livestock, motorsports. A booth or walk-through reaches rural Jefferson Co. families.",
    sourceUrl: "https://www.jeffersoncountyfair.net/",
    verifiedAt: VERIFIED,
  },
  {
    slug: "washington-town-country-fair",
    name: "Washington Town & Country Fair",
    suggestedType: "meet-greet",
    city: "Washington",
    county: "Franklin County",
    typicalWindow: "Early August (Wed–Sun)",
    cadence: "Annual (5-day fair, includes a parade)",
    blurb: "One of the region's largest fairs — rides, concerts, a parade. High-visibility western-county stop.",
    sourceUrl: "https://washmofair.com/",
    verifiedAt: VERIFIED,
  },
  {
    slug: "franklin-county-fair",
    name: "Franklin County Fair",
    suggestedType: "meet-greet",
    city: "Union",
    county: "Franklin County",
    typicalWindow: "Mid-June",
    cadence: "Annual",
    blurb: "County seat fair in Union — retail politics with Franklin Co. families ahead of the August primary.",
    sourceUrl: "https://www.facebook.com/franklincofair/",
    verifiedAt: VERIFIED,
  },
  {
    slug: "twin-city-firecracker-festival",
    name: "Twin City Firecracker Festival",
    suggestedType: "meet-greet",
    city: "Festus",
    county: "Jefferson County",
    typicalWindow: "Late June",
    cadence: "Annual",
    blurb: "Festus/Crystal City pre-July-4 festival — dense crowd in eastern Jefferson Co.",
    sourceUrl: "https://festivalguidesandreviews.com/missouri-festivals/",
    verifiedAt: VERIFIED,
  },
  {
    slug: "kirkwood-freedom-festival",
    name: "Kirkwood Freedom Festival & Fireworks",
    suggestedType: "meet-greet",
    city: "Kirkwood",
    county: "St. Louis County",
    typicalWindow: "July 4",
    cadence: "Annual",
    blurb: "Food trucks, live music, fireworks at Kirkwood Park — a marquee St. Louis-County-suburb crowd.",
    sourceUrl: "https://explorestlouis.com/whats-new/fourth-of-july-in-st-louis/",
    verifiedAt: VERIFIED,
  },
  {
    slug: "webster-groves-community-days",
    name: "Webster Groves Community Days (July 4 parade)",
    suggestedType: "parade",
    city: "Webster Groves",
    county: "St. Louis County",
    typicalWindow: "July 2 & 4 (parade steps off 10am July 4)",
    cadence: "Annual",
    blurb: "Classic Independence Day parade at Lockwood & Mason — a quintessential candidate walking route.",
    sourceUrl: "https://www.stlpr.org/culture-history/2026-06-18/4th-july-fireworks-celebrations-st-louis-st-charles-metro-east-2026",
    verifiedAt: VERIFIED,
  },
  {
    slug: "mo-gop-state-lincoln-days",
    name: "Missouri GOP State Lincoln Days",
    suggestedType: "meet-greet",
    city: "Springfield",
    county: "",
    typicalWindow: "Late February",
    cadence: "Annual (statewide party gathering)",
    blurb: "The statewide Republican gathering — activists, donors, and press in one place. Networking, not a district stop.",
    sourceUrl: "https://missouri.gop/events/",
    verifiedAt: VERIFIED,
  },
  {
    slug: "franklin-county-lincoln-day",
    name: "Franklin County Lincoln Day",
    suggestedType: "fundraiser",
    city: "Union",
    county: "Franklin County",
    typicalWindow: "Spring",
    cadence: "Annual (county GOP dinner)",
    blurb: "Franklin Co. Republican committee dinner — core primary voters and local party leaders.",
    sourceUrl: "https://missouri.gop/single-event/franklin-county-lincoln-day/",
    verifiedAt: VERIFIED,
  },
  {
    slug: "washington-county-lincoln-day",
    name: "Washington County Lincoln Day",
    suggestedType: "fundraiser",
    city: "Potosi",
    county: "Washington County",
    typicalWindow: "March",
    cadence: "Annual (county GOP luncheon/rally)",
    blurb: "Washington Co. Republican luncheon — reaches the district's southern rural base.",
    sourceUrl: "https://missouri.gop/events/",
    verifiedAt: VERIFIED,
  },
];

export function getOpportunity(slug: string): AppearanceOpportunity | null {
  return APPEARANCE_OPPORTUNITIES.find((o) => o.slug === slug) ?? null;
}

// Map an opportunity to a DRAFT event input. `start` is supplied by the caller
// (a placeholder the admin must replace — we never fabricate a real date), so
// this stays pure/testable. The cited source + verify reminder go in the body.
export function opportunityToEventInput(o: AppearanceOpportunity, opts: { createdBy: string; start: string }): EventInput {
  return {
    title: o.name,
    type: o.suggestedType,
    start: opts.start,
    location: { name: o.name, address: "", city: o.city, county: o.county },
    description:
      `${o.cadence}. Typically: ${o.typicalWindow}. ${o.blurb}\n\n` +
      `⚠ Set the real date/time before publishing — confirm 2026 dates and candidate participation with the organizer. ` +
      `Source: ${o.sourceUrl} (verified ${o.verifiedAt}).`,
    status: "DRAFT",
    source: "manual",
    createdBy: opts.createdBy,
  };
}

export const OPPORTUNITY_COUNTIES = [...new Set(APPEARANCE_OPPORTUNITIES.map((o) => o.county).filter(Boolean))].sort();
