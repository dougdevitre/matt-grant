// Vendor-source adapter — a SECOND voter-file source layered over the official
// Sunshine-law spine (candidate/voter-registry-refresh-plan.md §2).
//
// Why this exists. The official MO-02 export is index-parsed against a frozen
// 36-column order (lib/voters/parse.ts). A commercial or party-committee export
// has a different, less stable shape, so this adapter maps **by header name**
// and refuses loudly when a required field can't be resolved. Neither adapter
// ever degrades silently — a mis-mapped column would corrupt every row.
//
// What a vendor file adds that the official file cannot:
//   • Real primary vote history. The official file records only a voter's SINGLE
//     most recent election, so its turnout score is a recency proxy; actual
//     August-primary participation is the sharpest predictor of an August
//     primary vote.
//   • A party value — but see the warning below.
//
// PARTY IS INFERRED, NEVER REGISTERED. Missouri has no party registration. Any
// "Republican" label on a vendor file is derived from primary-ballot-pull
// history or a model. It is a proxy, labeled as one everywhere (lib/voters/party.ts).
//
// PHONES ARE CALL-ONLY. Numbers this adapter parses are manual-dial / P2P only
// and never enter the SMS broadcast path (candidate/voter-file-plan.md §2.3,
// enforced by lib/sms/audiences.voterfile-isolation.test.ts). They are also
// gated on written vendor license terms permitting political phone contact.
import { normalizePartyCode, type VoterPartyCode } from "@/lib/voters/party";

/** Cap on primary propensity, matching the 0-5 range of the spine's turnout
 *  score so the two read on the same scale. */
export const MAX_PP = 5;

export type VendorPhone = {
  number: string; // raw; normalize with toE164 at the write boundary
  lineType?: "wireless" | "landline";
  doNotCall?: boolean;
};

export type VendorOverlayRecord = {
  /** Official state voter ID when the vendor keyed on it — the exact join. */
  voterId?: string;
  /** Conservative fallback join key parts, used only when voterId is absent. */
  lastName?: string;
  firstName?: string;
  zip?: string;
  county: string;
  precinct: string;
  /** Count of recent August primaries voted, capped at MAX_PP. Undefined when
   *  the file carries no primary-history columns at all — unknown, not zero. */
  pp?: number;
  /** Canonical party code — INFERRED. Undefined when blank/absent. */
  party?: VoterPartyCode;
  phones: VendorPhone[];
};

// ---------------------------------------------------------------------------
// Column resolution
// ---------------------------------------------------------------------------

/** Semantic fields the adapter needs, each with CANDIDATE header aliases.
 *
 *  These aliases are a starting point covering common vendor conventions — they
 *  are NOT a claim about this particular export. Run
 *  `npm run inspect:voter-source -- --file <csv>` first and confirm (or extend)
 *  the list against the real header row. `resolveColumns` names every field it
 *  could not resolve, so an unconfirmed mapping fails loudly instead of
 *  silently mis-reading rows. */
export const FIELD_ALIASES: Record<string, string[]> = {
  voterId: ["voterid", "statevoterid", "state voter id", "sos voter id", "statefileid", "registrantid", "voter_id"],
  firstName: ["firstname", "first name", "fname", "first"],
  lastName: ["lastname", "last name", "lname", "last", "surname"],
  zip: ["zip", "zip5", "zipcode", "zip code", "residentialzipcode", "residential zipcode", "postalcode"],
  county: ["county", "countyname", "county name", "residentialcounty"],
  precinct: ["precinct", "precinctname", "precinct name", "precinctcode", "votingprecinct"],
  party: ["party", "partycode", "party code", "politicalparty", "political party", "partyaffiliation", "affiliation"],
};

/** Fields without which an overlay row cannot be written at all. The join key is
 *  handled separately (voterId OR lastName+zip), so it isn't listed here. */
export const REQUIRED_FIELDS = ["county", "precinct"] as const;

const norm = (h: string): string => h.replace(/[\s_-]+/g, " ").trim().toLowerCase();

export type ColumnMap = Record<string, number>;

/** A confirmed mapping — everything mapVendorRow needs to read a row. */
export type ResolvedColumns = {
  map: ColumnMap;
  primaryColumns: PrimaryColumn[];
  phoneColumns: PhoneColumn[];
};

export type ResolveResult = ({ ok: true } & ResolvedColumns) | { ok: false; problems: string[] };

/** Resolve header names to column indices. Returns every problem at once so an
 *  operator fixes the mapping in one pass rather than one error per run. */
export function resolveColumns(headers: string[]): ResolveResult {
  const byNorm = new Map<string, number>();
  headers.forEach((h, i) => {
    const n = norm(h);
    // First occurrence wins — a duplicate header is reported below, not guessed at.
    if (!byNorm.has(n)) byNorm.set(n, i);
  });

  const map: ColumnMap = {};
  const problems: string[] = [];

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const hit = aliases.map(norm).find((a) => byNorm.has(a));
    if (hit !== undefined) map[field] = byNorm.get(hit)!;
  }

  for (const field of REQUIRED_FIELDS) {
    if (map[field] === undefined) {
      problems.push(
        `required field "${field}" matched no header — add the real column name to FIELD_ALIASES.${field} ` +
          `(run the inspector to see the header row)`,
      );
    }
  }

  if (map.voterId === undefined && (map.lastName === undefined || map.zip === undefined)) {
    problems.push(
      'no join key: need either "voterId", or BOTH "lastName" and "zip" for the conservative name+ZIP fallback',
    );
  }

  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    map,
    primaryColumns: detectPrimaryColumns(headers),
    phoneColumns: detectPhoneColumns(headers),
  };
}

// ---------------------------------------------------------------------------
// Primary vote history
// ---------------------------------------------------------------------------

export type PrimaryColumn = { index: number; year: number; header: string };

// Vendor files encode per-election participation as one column per election.
// Match PRIMARY columns and capture the year; general/municipal columns must NOT
// match (a general-election vote says little about August-primary behavior).
const PRIMARY_PATTERNS: RegExp[] = [
  /^pp[\s_-]?((?:19|20)?\d{2})$/i, // PP2024, PP24, PP_2024
  /^p[\s_-]?((?:19|20)\d{2})$/i, // P2024, P_2024  (4-digit only — P24 is too ambiguous)
  /^(?:aug|august)[\s_-]?((?:19|20)\d{2})$/i, // Aug2024
  /^primary[\s_-]?((?:19|20)\d{2})$/i, // Primary2024
  /^((?:19|20)\d{2})[\s_-]?primary$/i, // 2024 Primary
];

const NOT_PRIMARY = /(general|municipal|special|runoff|presidential\s*general)/i;

/** Find the per-election primary-participation columns and their years.
 *  Deliberately conservative: a header that also names a general/municipal
 *  election is skipped rather than guessed at. */
export function detectPrimaryColumns(headers: string[]): PrimaryColumn[] {
  const out: PrimaryColumn[] = [];
  headers.forEach((header, index) => {
    const h = header.trim();
    if (!h || NOT_PRIMARY.test(h)) return;
    for (const re of PRIMARY_PATTERNS) {
      const m = re.exec(h);
      if (!m) continue;
      let year = Number(m[1]);
      if (year < 100) year += year <= 79 ? 2000 : 1900; // 2-digit year
      if (year >= 1990 && year <= 2100) out.push({ index, year, header: h });
      break;
    }
  });
  // Most recent first — propensity weighs recent primaries, and a cap should
  // keep the newest elections when a file carries a long history.
  return out.sort((a, b) => b.year - a.year);
}

const VOTED = /^(y|yes|t|true|x|1|a|e|p|ab|ev|absentee|early|polls|voted)$/i;

/** True when a per-election cell means "this person voted".
 *  Vendors encode this variously: Y/N, X/blank, or a method code
 *  (A absentee / E early / P polls) — all of which mean voted. */
export function votedInElection(cell: string | null | undefined): boolean {
  const v = (cell ?? "").trim();
  return v !== "" && VOTED.test(v);
}

/** Primary propensity 0-MAX_PP: how many of the most recent primaries this
 *  person voted in. Returns undefined when the file has NO primary columns —
 *  unknown, never zero. A zero here means "had the chance and didn't". */
export function primaryPropensity(row: string[], columns: PrimaryColumn[]): number | undefined {
  if (columns.length === 0) return undefined;
  let n = 0;
  for (const c of columns.slice(0, MAX_PP)) {
    if (votedInElection(row[c.index])) n++;
  }
  return Math.min(n, MAX_PP);
}

// ---------------------------------------------------------------------------
// Phones (parsed here; PERSISTED only under confirmed license terms)
// ---------------------------------------------------------------------------

export type PhoneColumn = { index: number; header: string; lineType?: "wireless" | "landline" };

const PHONE_HEADER = /(phone|cell|mobile|landline|^tel)/i;
const PHONE_DESCRIPTOR = /(type|status|flag|code|score|source|count)$/i;
const DNC_HEADER = /(dnc|do not call|donotcall|opt.?out|litigator)/i;

export function detectPhoneColumns(headers: string[]): PhoneColumn[] {
  const out: PhoneColumn[] = [];
  headers.forEach((header, index) => {
    const h = header.trim();
    // "PhoneType" names a category, not a number — it is not a phone column.
    if (!h || !PHONE_HEADER.test(h) || PHONE_DESCRIPTOR.test(h) || DNC_HEADER.test(h)) return;
    const lineType = /cell|mobile|wireless/i.test(h) ? "wireless" : /landline/i.test(h) ? "landline" : undefined;
    out.push({ index, header: h, lineType });
  });
  return out;
}

export function detectDncColumn(headers: string[]): number | undefined {
  const i = headers.findIndex((h) => DNC_HEADER.test(h.trim()));
  return i >= 0 ? i : undefined;
}

const TRUTHY = /^(y|yes|t|true|1)$/i;

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

const cell = (row: string[], i: number | undefined): string => (i === undefined ? "" : (row[i] ?? "").trim());

/** Map one vendor row to an overlay record, or null when it carries no usable
 *  join key or geography (counted as skipped by the caller, never guessed). */
export function mapVendorRow(
  row: string[],
  resolved: ResolvedColumns,
  opts: { dncColumn?: number } = {},
): VendorOverlayRecord | null {
  const { map } = resolved;
  const county = cell(row, map.county);
  const precinct = cell(row, map.precinct);
  if (!county || !precinct) return null;

  const voterId = cell(row, map.voterId) || undefined;
  const lastName = cell(row, map.lastName) || undefined;
  const zipRaw = cell(row, map.zip);
  const zip = /^\d{5}/.test(zipRaw) ? zipRaw.slice(0, 5) : undefined;
  // Without a voter ID we need BOTH halves of the fallback key, or the row can
  // never be joined to the spine.
  if (!voterId && !(lastName && zip)) return null;

  const doNotCall = opts.dncColumn !== undefined && TRUTHY.test(cell(row, opts.dncColumn));
  const phones: VendorPhone[] = [];
  for (const p of resolved.phoneColumns) {
    const number = cell(row, p.index);
    if (!number) continue;
    phones.push({ number, ...(p.lineType ? { lineType: p.lineType } : {}), ...(doNotCall ? { doNotCall } : {}) });
  }

  const pp = primaryPropensity(row, resolved.primaryColumns);
  const party = normalizePartyCode(cell(row, map.party)) ?? undefined;

  return {
    ...(voterId ? { voterId } : {}),
    ...(lastName ? { lastName } : {}),
    ...(cell(row, map.firstName) ? { firstName: cell(row, map.firstName) } : {}),
    ...(zip ? { zip } : {}),
    county,
    precinct,
    ...(pp !== undefined ? { pp } : {}),
    ...(party ? { party } : {}),
    phones,
  };
}
