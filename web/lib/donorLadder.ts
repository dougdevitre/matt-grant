// The donor value ladder — single source for the recognition tiers shown on
// /donate and named in the donation thank-you email. Mirrors
// candidate/donor-value-ladder.md exactly; edit BOTH together. Compliance
// framing (per that doc's §3, verified 2026-07-10): tiers are the committee's
// guaranteed thank-yous, never a purchase — the FULL contribution counts
// against FEC limits ($3,500/election for 2025-26; $7,000 = primary + general).
// Pure and client-safe.

export type LadderRung = {
  amountCents: number; // cycle-to-date threshold (tiers key on cumulative giving)
  name: string;
  unlocks: string[]; // what THIS rung adds (rungs stack — lower unlocks included)
  note?: string; // limit framing for the top rungs
};

export const LADDER: LadderRung[] = [
  { amountCents: 25_00, name: "Front Porch Friend", unlocks: ["Sticker pack", "Printable window sign"] },
  { amountCents: 50_00, name: "Yard Sign Crew", unlocks: ["Official yard sign, delivered by your area captain"] },
  { amountCents: 100_00, name: "Grant Team Tee", unlocks: ["Campaign T-shirt"] },
  {
    amountCents: 250_00,
    name: "Precinct Partner",
    unlocks: ["Full schwag kit (tee, hat, stickers, sign)", "The insider field-briefing email"],
  },
  { amountCents: 500_00, name: "Captain's Circle", unlocks: ["Invitation to a supporter reception with Matt"] },
  {
    amountCents: 1000_00,
    name: "MO-02 Founders Club",
    unlocks: ["Founding-supporter listing (with your permission)", "Small-group coffee with Matt"],
  },
  {
    amountCents: 3500_00,
    name: "Primary Champion",
    unlocks: ["Seat at a private roundtable dinner with Matt", "Framed, signed MO-02 map"],
    note: "The federal per-election maximum ($3,500 for 2025–2026).",
  },
  {
    amountCents: 7000_00,
    name: "Full-Cycle Champion",
    unlocks: ["Election-night host-committee listing", "A second roundtable seat"],
    note: "$3,500 primary + $3,500 general — the cycle maximum; the general portion is designated to the general election.",
  },
];

/**
 * WinRed deep link: preselects the amount on the donation page (WinRed's
 * documented `?amount=` URL parameter, verified 2026-07-10) and stamps a
 * per-surface source code (`sc`) so WinRed reports show which button, letter,
 * or email drove each gift. Proper URL building — works whether or not the
 * base already carries a query string, and never duplicates params. Attribution
 * labels only: no donor PII ever rides the URL.
 */
export function donateHref(base: string, amountCents: number, sc?: string): string {
  const url = new URL(base);
  const dollars = amountCents / 100;
  url.searchParams.set("amount", Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2));
  if (sc) url.searchParams.set("sc", sc);
  return url.toString();
}

/** Highest rung reached by a cycle-to-date total; null below the first rung. */
export function ladderTierForCents(totalCents: number): LadderRung | null {
  let hit: LadderRung | null = null;
  for (const rung of LADDER) {
    if (totalCents >= rung.amountCents) hit = rung;
    else break;
  }
  return hit;
}

/** The next rung above a cycle-to-date total; null at/above the top. */
export function nextRung(totalCents: number): LadderRung | null {
  return LADDER.find((r) => totalCents < r.amountCents) ?? null;
}
