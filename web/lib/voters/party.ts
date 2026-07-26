// Party coding for voter records — normalization + the canonical code list.
//
// IMPORTANT, and stated everywhere this value surfaces: in Missouri a party
// value is **inferred, never registered**. Missouri has no party registration,
// so the official Sunshine-law file leaves the party field blank for ~90% of
// rows (candidate/voter-file-plan.md §1) and any "Republican"/"Democratic"
// label on a vendor export is DERIVED — from primary-ballot-pull history or a
// modeled partisanship score. Treat it exactly like the S support proxy: usable
// for targeting, labeled as a proxy, never presented as fact about a voter.
//
// The code list is mirrored as string literals in lib/sms/audiences.ts (it
// cannot be imported there — the TCPA isolation guard forbids lib/sms/ from
// referencing lib/voters/). Keep the two in sync; audiences.test.ts asserts the
// mirror matches.

/** Canonical party codes. Deliberately coarse — a vendor's finer-grained codes
 *  collapse into these so the composer's targeting grammar stays stable across
 *  file refreshes and vendors. */
export const VOTER_PARTY_CODES = ["REP", "DEM", "UNA", "OTH"] as const;
export type VoterPartyCode = (typeof VOTER_PARTY_CODES)[number];

export function isVoterPartyCode(v: string): v is VoterPartyCode {
  return (VOTER_PARTY_CODES as readonly string[]).includes(v);
}

/** Normalize a raw party value from any source to a canonical code.
 *  Returns null for blank/unknown — an absent party is NOT "other", and the
 *  difference matters: a targeting filter must not sweep up unknowns. */
export function normalizePartyCode(raw: string | null | undefined): VoterPartyCode | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (/^(r|rep|republican|gop)$/.test(v) || v.startsWith("repub")) return "REP";
  if (/^(d|dem|democrat|democratic)$/.test(v) || v.startsWith("democ")) return "DEM";
  if (/^(u|una|unaff|unaffiliated|i|ind|independent|npa|none|no party)$/.test(v)) return "UNA";
  if (/^(l|lib|libertarian|g|grn|green|c|con|constitution|other|oth)$/.test(v)) return "OTH";
  return "OTH";
}
