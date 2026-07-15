// Voter-file row parsing — pure and unit-tested with SYNTHETIC fixtures only
// (never real voter rows; see candidate/voter-file-plan.md §2 for the custody
// rules that govern this data). The MO-02 export is 36 columns, one row per
// registered voter; the shapes here were verified against the real file's
// header + aggregate inspection on 2026-07-10:
//   - Birthdate is a 4-digit birth YEAR
//   - Party is blank for ~90% of rows (Missouri has no party registration)
//   - "Voter History" holds ONLY the most recent election, e.g.
//     "11/05/2024 General" or "04/07/2026 Municipal General"
//   - "CONGRESSIONAL DISTRICT 25" carries the operative 2025-map coding
//     ("25 CN 2" = in-district)

export type LastVoted = { date: string; year: number; label: string } | null;

export type VoterRecord = {
  voterId: string;
  county: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  address: string; // assembled street address (house + street), no city
  unit?: string;
  city: string;
  zip: string;
  mailingAddress?: string; // only when different from residential
  yob: number | null; // birth year
  party?: string; // trimmed; undefined when blank
  regDate: string | null; // ISO date
  precinct: string; // raw precinct code
  precinctName: string;
  split?: string;
  township?: string;
  ward?: string;
  cd2025: string; // e.g. "25 CN 2"
  inDistrict: boolean; // cd2025 codes CD-2 under the operative map
  active: boolean;
  lastVoted: LastVoted;
};

// Column order of the export (verified header). Index-based so the parser
// never depends on locale-mangled header strings.
export const COLUMNS = [
  "County", "Voter ID", "First Name", "Middle Name", "Last Name", "Suffix",
  "Non Standard Address", "House Number", "House Suffix", "Pre Direction",
  "Street Name", "Street Type", "Post Direction", "Unit Type", "Unit Number",
  "Residential City", "Residential State", "Residential ZipCode",
  "Mailing Address", "Mailing City", "Mailing State", "Mailing ZipCode",
  "Birthdate", "Political Party", "Registration Date", "Precinct",
  "Precinct Name", "Split", "Township", "Ward",
  "CONGRESSIONAL DISTRICT 20", "CONGRESSIONAL DISTRICT 25",
  "LEGISLATIVE DISTRICT 20", "SENATE DISTRICT 20", "Voter Status", "Voter History",
] as const;

const normHeader = (v: unknown): string => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Validate a file's header row against COLUMNS. Parsing is INDEX-BASED, so a
 * reordered/renamed/missing column would silently mis-read every row (worse than
 * skipping) — the ingest must fail loudly instead. Returns human-readable
 * problems in column order; an empty array means the header matches. Extra
 * trailing columns beyond COLUMNS are allowed (only indices 0..35 are read).
 */
export function validateHeader(header: unknown[]): string[] {
  if (!Array.isArray(header)) return ["header row is missing or not a row"];
  const problems: string[] = [];
  if (header.length < COLUMNS.length) {
    problems.push(`expected at least ${COLUMNS.length} columns, got ${header.length}`);
  }
  for (let i = 0; i < COLUMNS.length; i++) {
    if (normHeader(header[i]) !== normHeader(COLUMNS[i])) {
      problems.push(`col ${i}: expected "${COLUMNS[i]}", got "${header[i] ?? "(missing)"}"`);
    }
  }
  return problems;
}

const str = (v: unknown): string => (v == null ? "" : String(v).trim());
const opt = (v: unknown): string | undefined => {
  const s = str(v);
  return s ? s : undefined;
};

/** "11/05/2024 General" → {date: "2024-11-05", year: 2024, label: "General"}; null on blank/garbage. */
export function parseLastVoted(raw: unknown): LastVoted {
  const s = str(raw);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(.+)$/);
  if (!m) return null;
  const [, mm, dd, yyyy, label] = m;
  const year = Number(yyyy);
  if (year < 1900 || year > 2100) return null;
  return { date: `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`, year, label: label.trim() };
}

/** Excel/xlsx date cell (Date object or string) → ISO date, else null. */
export function parseRegDate(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
  const s = str(raw);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : null;
}

/** Assemble the street address from the export's parsed parts. */
export function assembleAddress(r: unknown[]): { address: string; unit?: string } {
  const nonStd = str(r[6]);
  if (nonStd) return { address: nonStd };
  const parts = [str(r[7]), str(r[8]), str(r[9]), str(r[10]), str(r[11]), str(r[12])].filter(Boolean);
  const unitType = str(r[13]);
  const unitNo = str(r[14]);
  const unit = unitType || unitNo ? [unitType, unitNo].filter(Boolean).join(" ") : undefined;
  return { address: parts.join(" "), ...(unit ? { unit } : {}) };
}

/** The operative-map district code marks CD-2 (e.g. "25 CN 2"). */
export function isCd2(cd2025: string): boolean {
  return /\bCN\s*2$/.test(cd2025.trim());
}

/**
 * One raw xlsx row (array in COLUMNS order) → VoterRecord, or null when the row
 * lacks the identity minimum (Voter ID + last name + county). Defensive on
 * every field — a malformed cell degrades that field, never the row.
 */
export function parseVoterRow(r: unknown[]): VoterRecord | null {
  const voterId = str(r[1]);
  const lastName = str(r[4]);
  const county = str(r[0]);
  if (!voterId || !lastName || !county) return null;
  const { address, unit } = assembleAddress(r);
  const yobRaw = Number(str(r[22]));
  const yob = Number.isInteger(yobRaw) && yobRaw >= 1900 && yobRaw <= 2010 ? yobRaw : null;
  const party = opt(r[23]);
  const mailing = opt(r[18]);
  const cd2025 = str(r[31]);
  return {
    voterId,
    county,
    firstName: str(r[2]),
    lastName,
    middleName: opt(r[3]),
    suffix: opt(r[5]),
    address,
    ...(unit ? { unit } : {}),
    city: str(r[15]),
    zip: str(r[17]).slice(0, 5),
    ...(mailing ? { mailingAddress: [mailing, str(r[19]), str(r[20]), str(r[21])].filter(Boolean).join(", ") } : {}),
    yob,
    ...(party ? { party } : {}),
    regDate: parseRegDate(r[24]),
    precinct: str(r[25]),
    precinctName: str(r[26]),
    split: opt(r[27]),
    township: opt(r[28]),
    ward: opt(r[29]),
    cd2025,
    inDistrict: isCd2(cd2025),
    active: /^active$/i.test(str(r[34])),
    lastVoted: parseLastVoted(r[35]),
  };
}

export const AGE_BANDS = ["18-24", "25-34", "35-49", "50-64", "65+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number] | "unknown";

/** Age band for the 2026 cycle from a birth year (the file has no full DOB). */
export function ageBand(yob: number | null, cycleYear = 2026): AgeBand {
  if (yob == null) return "unknown";
  const age = cycleYear - yob;
  if (age < 18) return "unknown";
  if (age <= 24) return "18-24";
  if (age <= 34) return "25-34";
  if (age <= 49) return "35-49";
  if (age <= 64) return "50-64";
  return "65+";
}
