// Voter-source schema inspection — pure, unit-tested, no IO.
//
// Answers "what columns does this export actually have?" for a file too large to
// open by hand, so a source adapter can be written against real column names
// instead of guesses (candidate/voter-registry-refresh-plan.md §2).
//
// PRIVACY: everything here reduces values to SHAPES. A column's report carries a
// type, a length range, a fill rate, and — only when the column is
// low-cardinality AND does not hold personal data — its distinct value set. No
// name, street address, phone number, or email is ever retained or rendered.
// Same posture as the other reports: counts, never lists.

/** Excel's hard worksheet limit. A vendor CSV re-saved through Excel silently
 *  loses every row past this, so a count at/near the cap means the file is very
 *  likely truncated and must be re-exported from the original CSV. */
export const EXCEL_ROW_CAP = 1_048_576;

// ---------------------------------------------------------------------------
// Streaming CSV parser
// ---------------------------------------------------------------------------

/** RFC-4180 state machine that survives chunk boundaries — including a `""`
 *  escape split across two reads, which is what `pendingQuote` exists for.
 *  Handles embedded delimiters, embedded newlines, and escaped quotes. */
export function makeCsvParser(delimiter: string, onRow: (row: string[]) => void) {
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let pendingQuote = false;
  let sawAny = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    // Ignore the blank row a trailing newline produces.
    if (!(row.length === 1 && row[0] === "")) onRow(row);
    row = [];
  };

  const plain = (ch: string) => {
    if (ch === '"' && field === "") inQuotes = true;
    else if (ch === delimiter) endField();
    else if (ch === "\n") endRow();
    else if (ch !== "\r") field += ch;
  };

  return {
    write(chunk: string) {
      for (const ch of chunk) {
        sawAny = true;
        if (inQuotes) {
          if (pendingQuote) {
            pendingQuote = false;
            if (ch === '"') field += '"';
            else {
              inQuotes = false;
              plain(ch);
            }
          } else if (ch === '"') pendingQuote = true;
          else field += ch;
        } else plain(ch);
      }
    },
    end() {
      pendingQuote = false;
      inQuotes = false;
      if (sawAny && (field !== "" || row.length > 0)) endRow();
    },
  };
}

/** Guess the delimiter from the first line, counting only outside quotes. */
export function sniffDelimiter(head: string): string {
  const line = head.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", "\t", "|", ";"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Value classification
// ---------------------------------------------------------------------------

export type Kind =
  | "empty"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "year"
  | "zip5"
  | "zip9"
  | "state"
  | "phone"
  | "email"
  | "text";

const RE = {
  integer: /^-?\d+$/,
  decimal: /^-?\d*\.\d+$/,
  boolean: /^(y|n|yes|no|true|false|t|f)$/i,
  isoDate: /^\d{4}-\d{2}-\d{2}(T.*)?$/,
  usDate: /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
  year: /^(19|20)\d{2}$/,
  zip5: /^\d{5}$/,
  zip9: /^\d{5}-?\d{4}$/,
  state: /^[A-Z]{2}$/,
  phone: /^\+?1?[\s.\-()]*\d{3}[\s.\-()]*\d{3}[\s.\-]*\d{4}$/,
  email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
};

export function classify(v: string): Kind {
  if (v === "") return "empty";
  if (RE.email.test(v)) return "email";
  if (RE.zip5.test(v)) return "zip5";
  if (RE.zip9.test(v)) return "zip9";
  if (RE.year.test(v)) return "year";
  if (RE.phone.test(v) && v.replace(/\D/g, "").length >= 10) return "phone";
  if (RE.integer.test(v)) return "integer";
  if (RE.decimal.test(v)) return "decimal";
  if (RE.boolean.test(v)) return "boolean";
  if (RE.isoDate.test(v) || RE.usDate.test(v)) return "date";
  if (RE.state.test(v)) return "state";
  return "text";
}

/** Headers whose VALUES are personal data. Deliberately precise: `CountyName`
 *  and `PrecinctName` are geography, not identity, and their distinct sets are
 *  the most useful thing in the report. */
const PII_HEADER = new RegExp(
  [
    String.raw`\b(first|last|middle|maiden|nick|sur|full|reg|voter)[_\s]?name\b`,
    String.raw`^(name|nm|fn|ln|mn)$`,
    String.raw`(addr|street|house|apt|suite|^unit)`,
    String.raw`(phone|cell|mobile|^tel|landline)`,
    String.raw`(email|e_?mail)`,
    String.raw`(dob|birth[_\s]?date|ssn|driver|license|latitude|longitude|\blat\b|\blon\b|\blng\b)`,
  ].join("|"),
  "i",
);

/** A header ending in a descriptor names a CATEGORY, not a person — `PhoneType`
 *  holds "Wireless"/"Landline", not a number. Those distinct sets are safe and
 *  necessary: they tell the adapter how to route the column. */
const DESCRIPTOR_HEADER = /(type|flag|status|code|ind|indicator|count|score|desc|source|rank|tier|band)$/i;

const PII_KIND = new Set<Kind>(["phone", "email"]);

/** Values are personal data if they LOOK like it, or if the header says so and
 *  the header isn't merely naming a category. A bare 4-digit year is coarse
 *  enough to report as a range, and that range is useful for age banding. */
export function isMasked(header: string, kind: Kind): boolean {
  if (PII_KIND.has(kind)) return true;
  if (kind === "year") return false;
  return PII_HEADER.test(header) && !DESCRIPTOR_HEADER.test(header);
}

/** Which pipeline a column feeds. Drives the report's Signals table and the
 *  TCPA / join-key warnings. */
export const SIGNAL = {
  phone: /(phone|cell|mobile|tel|landline|wireless)/i,
  consent: /(dnc|do_?not_?call|opt_?out|opt_?in|consent|litigator|tcpa)/i,
  lineType: /(wireless|landline|line_?type|phone_?type)/i,
  voterId: /(voter_?id|statevoterid|state_?file|regi?strant_?id|lalvoterid|rnc_?id)/i,
  voteHistory: /(primary|general|municipal|pp?\d{2}|gen\d{2}|20\d\d|election|vote_?hist|turnout)/i,
  party: /(party|partisan|affiliation|rep_?score|gop|political)/i,
  district: /(congress|district|precinct|ward|township|county|cd$|sd$|hd$|leg)/i,
  score: /(score|model|likelihood|propensity|probability|percentile|decile)/i,
};

// ---------------------------------------------------------------------------
// Column statistics
// ---------------------------------------------------------------------------

export type ColStat = {
  header: string;
  index: number;
  nonEmpty: number;
  kinds: Map<Kind, number>;
  minLen: number;
  maxLen: number;
  distinct: Set<string>;
  distinctOverflow: boolean;
  numericMin: number | null;
  numericMax: number | null;
};

export function newCol(header: string, index: number): ColStat {
  return {
    header,
    index,
    nonEmpty: 0,
    kinds: new Map(),
    minLen: Number.POSITIVE_INFINITY,
    maxLen: 0,
    distinct: new Set(),
    distinctOverflow: false,
    numericMin: null,
    numericMax: null,
  };
}

export function observe(col: ColStat, raw: string, distinctCap: number): void {
  const v = raw.trim();
  if (v === "") return;
  col.nonEmpty++;
  col.minLen = Math.min(col.minLen, v.length);
  col.maxLen = Math.max(col.maxLen, v.length);
  const kind = classify(v);
  col.kinds.set(kind, (col.kinds.get(kind) ?? 0) + 1);
  if (kind === "integer" || kind === "decimal" || kind === "year") {
    const n = Number(v);
    if (Number.isFinite(n)) {
      col.numericMin = col.numericMin === null ? n : Math.min(col.numericMin, n);
      col.numericMax = col.numericMax === null ? n : Math.max(col.numericMax, n);
    }
  }
  if (!col.distinctOverflow) {
    // Cap the set so a high-cardinality column (a name, an address) can never
    // accumulate real values in memory, let alone reach the report.
    if (col.distinct.size >= distinctCap * 4) {
      col.distinctOverflow = true;
      col.distinct.clear();
    } else col.distinct.add(v);
  }
}

export function dominantKind(col: ColStat): Kind {
  if (col.nonEmpty === 0) return "empty";
  let best: Kind = "text";
  let bestN = -1;
  for (const [k, n] of col.kinds) {
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export type ScanResult = {
  headers: string[];
  cols: ColStat[];
  totalRows: number;
  sampledRows: number;
  raggedRows: number;
  exactCount: boolean;
  sheets?: string[];
  delimiter?: string;
};

const pct = (n: number, d: number): string => (d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}%`);

/** True when the row count is at or near Excel's cap — i.e. the file was very
 *  likely re-saved through Excel and silently truncated. Only meaningful when
 *  the count is exact. */
export function looksTruncated(totalRows: number, exactCount: boolean): boolean {
  return exactCount && totalRows >= EXCEL_ROW_CAP * 0.99;
}

export function renderReport(fileName: string, r: ScanResult, distinctCap: number): string {
  const L: string[] = [];
  const push = (s = "") => L.push(s);

  push(`# Voter source schema report — \`${fileName}\``);
  push();
  push(
    "Shapes only — no row values. Generated by `web/scripts/inspect-voter-source.ts`. " +
      "Fill the adapter's field-mapping table from the Columns section below; do not guess column names.",
  );
  push();

  push("## File");
  push();
  push("| Fact | Value |");
  push("|---|---|");
  push(`| Columns | ${r.headers.length} |`);
  push(`| Data rows | ${r.totalRows.toLocaleString()}${r.exactCount ? "" : " (lower bound — sample-limited)"} |`);
  push(`| Rows sampled for typing | ${r.sampledRows.toLocaleString()} |`);
  push(`| Ragged rows (column count ≠ header) | ${r.raggedRows.toLocaleString()} |`);
  if (r.delimiter) push(`| Delimiter | \`${r.delimiter === "\t" ? "\\t" : r.delimiter}\` |`);
  if (r.sheets) push(`| Sheets | ${r.sheets.length} — ${r.sheets.map((s) => `\`${s}\``).join(", ")} |`);
  push();

  if (looksTruncated(r.totalRows, r.exactCount)) {
    push(
      `> **TRUNCATION WARNING.** ${r.totalRows.toLocaleString()} rows is at or near Excel's ` +
        `${EXCEL_ROW_CAP.toLocaleString()}-row worksheet cap. If this file was ever opened and re-saved in ` +
        "Excel, rows past the cap were silently dropped. Re-export from the original source before trusting " +
        "any count, universe, or send list built from it.",
    );
    push();
  } else if (!r.exactCount) {
    push(
      "> **Row count is not exact** in this mode (xlsx, or `--fast`). Excel's " +
        `${EXCEL_ROW_CAP.toLocaleString()}-row cap silently truncates re-saved CSVs, so run this against the ` +
        "original CSV without `--fast` to get an exact count and a real truncation check.",
    );
    push();
  }

  const sig = (re: RegExp) => r.cols.filter((c) => re.test(c.header)).map((c) => c.header);
  const phoneCols = r.cols.filter((c) => SIGNAL.phone.test(c.header) || dominantKind(c) === "phone");

  push("## Signals");
  push();
  push("| Signal | Columns |");
  push("|---|---|");
  const sigRow = (label: string, names: string[]) =>
    push(`| ${label} | ${names.length ? names.map((n) => `\`${n}\``).join(", ") : "_none detected_"} |`);
  sigRow("Phone-bearing", phoneCols.map((c) => c.header));
  sigRow("Line type (wireless/landline)", sig(SIGNAL.lineType));
  sigRow("Consent / DNC / litigator", sig(SIGNAL.consent));
  sigRow("Voter ID (join key)", sig(SIGNAL.voterId));
  sigRow("Vote history", sig(SIGNAL.voteHistory));
  sigRow("Party / partisanship", sig(SIGNAL.party));
  sigRow("Geography / district", sig(SIGNAL.district));
  sigRow("Modeled scores", sig(SIGNAL.score));
  push();

  if (phoneCols.length) {
    push(
      "> **Phones present.** Under `candidate/voter-file-plan.md` §2.3 these are **manual-dial and P2P only** — " +
        "they never enter the SMS broadcast path, which is gated on the consent ledger. Loading them is also " +
        "blocked until the vendor's written license terms are confirmed to permit political phone contact.",
    );
    push();
  }
  if (!sig(SIGNAL.voterId).length) {
    push(
      "> **No obvious voter-ID column.** The overlay join will fall back to name + ZIP5 with ambiguous keys " +
        "dropped, which lowers the match rate. Confirm with the vendor whether an official state voter ID can " +
        "be included in a re-export — an ID-keyed file matches exactly.",
    );
    push();
  }

  push("## Columns");
  push();
  push("| # | Header | Type | Fill | Len | Range / distinct values |");
  push("|--:|---|---|--:|---|---|");
  for (const c of r.cols) {
    const kind = dominantKind(c);
    const fill = pct(c.nonEmpty, r.sampledRows);
    const len = c.nonEmpty === 0 ? "—" : c.minLen === c.maxLen ? String(c.maxLen) : `${c.minLen}–${c.maxLen}`;
    let detail: string;
    if (isMasked(c.header, kind)) {
      detail = "_withheld (personal data)_";
    } else if (c.distinctOverflow || c.distinct.size > distinctCap) {
      detail = `high cardinality (>${distinctCap} distinct)`;
      if (c.numericMin !== null) detail += ` · ${c.numericMin}–${c.numericMax}`;
    } else if (c.distinct.size > 0) {
      detail = [...c.distinct]
        .sort()
        .map((v) => `\`${v}\``)
        .join(" ");
    } else {
      detail = "_always empty in sample_";
    }
    // Keep the markdown table intact: a value may legally contain a pipe or an
    // embedded newline (both survive RFC-4180 quoting).
    detail = detail.replace(/\|/g, "\\|").replace(/\r?\n/g, "⏎");
    push(`| ${c.index} | \`${c.header}\` | ${kind} | ${fill} | ${len} | ${detail} |`);
  }
  push();
  push("---");
  push();
  push(
    "*Educational information, not legal advice. Vendor license terms, RSMo §115.157 voter-list use " +
      "restrictions, and the TCPA all govern what may be done with this data — consult counsel before a new " +
      "phone or texting program.*",
  );
  return L.join("\n");
}
