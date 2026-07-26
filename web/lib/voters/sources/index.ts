// Voter-source registry (candidate/voter-registry-refresh-plan.md §2).
//
// The campaign now ingests more than one kind of voter file:
//
//   official    — the RSMo §115.157 Sunshine-law export from the election
//                 authority. The REGISTRATION SPINE: every registered voter,
//                 the district denominator, the precinct rollups, the chase
//                 board. Index-parsed against a frozen 36-column order.
//   vendorRepub — a commercial / party-committee export. An OVERLAY only:
//                 primary vote history and an inferred party, joined onto the
//                 spine by voter ID (or a conservative name+ZIP fallback).
//                 Header-name-mapped, because vendor column order is not stable.
//
// The two are deliberately NOT interchangeable. A vendor file is a filtered
// universe (e.g. Republicans only), so it can never define the denominator:
// VOTERAGG is recomputed wholesale from the official files, and folding a
// partial universe into that pass would corrupt the district census, the
// six-county mix, and the chase board's outstanding-ballot math.
import { COLUMNS, validateHeader } from "@/lib/voters/parse";
import { resolveColumns } from "@/lib/voters/sources/vendorRepub";

export const SOURCE_KEYS = ["official", "vendorRepub"] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

export function isSourceKey(v: string): v is SourceKey {
  return (SOURCE_KEYS as readonly string[]).includes(v);
}

export type SourceRole = "spine" | "overlay";

export const SOURCE_ROLE: Record<SourceKey, SourceRole> = {
  official: "spine",
  vendorRepub: "overlay",
};

export type DetectResult =
  | { ok: true; source: SourceKey }
  | { ok: false; problems: string[] };

/** Identify which source a header row belongs to.
 *
 *  Deliberately strict in both directions: a header that is *nearly* the
 *  official 36 columns is reported as a drifted official file (not silently
 *  treated as a vendor file), because index-based parsing would then mis-read
 *  every row. A header that resolves the vendor adapter's required fields is a
 *  vendor file. Anything else fails with the reasons from both attempts, so the
 *  operator can see exactly what to fix. */
export function detectSource(headers: unknown[]): DetectResult {
  const officialProblems = validateHeader(headers);
  if (officialProblems.length === 0) return { ok: true, source: "official" };

  // Check for DRIFT before trying the vendor adapter, not after. The official
  // export shares field names with vendor files ("County", "Voter ID", "Last
  // Name", "Precinct"…), so a drifted official header WILL satisfy the vendor
  // adapter's requirements — and loading it as an overlay would quietly mis-read
  // a spine file instead of failing. Proximity to the official layout wins.
  const nearOfficial = officialProblems.length <= Math.ceil(COLUMNS.length / 4);
  if (nearOfficial) {
    return {
      ok: false,
      problems: [
        `header looks like a DRIFTED official export (${officialProblems.length} of ${COLUMNS.length} columns off) — ` +
          "re-verify the export rather than loading it as a vendor file:",
        ...officialProblems.slice(0, 10),
      ],
    };
  }

  const vendor = resolveColumns(headers.map((h) => String(h ?? "")));
  if (vendor.ok) return { ok: true, source: "vendorRepub" };

  return { ok: false, problems: ["header matches no known source.", "As a vendor file:", ...vendor.problems] };
}
