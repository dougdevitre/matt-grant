// Pure CSV parsing + volunteer-row mapping. No DB/AWS imports, so the dashboard
// import panel can run the same parser client-side for a live preview before the
// server action writes anything.

// RFC-4180-ish CSV: handles quoted fields, embedded commas/newlines, "" escapes,
// and CRLF. Returns a 2-D array of cells; fully-blank lines are dropped.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export type VolunteerImportRow = { name: string; email?: string; phone?: string; city?: string; interests?: string };

// Header → field, case-insensitive. Common spreadsheet column names are accepted.
const HEADER_ALIASES: Record<string, keyof VolunteerImportRow> = {
  name: "name", "full name": "name", fullname: "name", "contact name": "name", contact: "name",
  email: "email", "email address": "email", "e-mail": "email", emailaddress: "email",
  phone: "phone", "phone number": "phone", mobile: "phone", cell: "phone", telephone: "phone", "cell phone": "phone",
  city: "city", town: "city", municipality: "city",
  interests: "interests", interest: "interests", notes: "interests", note: "interests", tags: "interests", skills: "interests",
};

export type VolunteerMapResult = { valid: VolunteerImportRow[]; skipped: number; total: number; mappedColumns: (keyof VolunteerImportRow)[] };

// Map parsed CSV rows (first row = header) into validated volunteer rows. A row is
// valid only with a name AND at least one of email/phone (the intake's minimum).
export function mapVolunteers(rows: string[][]): VolunteerMapResult {
  if (rows.length === 0) return { valid: [], skipped: 0, total: 0, mappedColumns: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx: Partial<Record<keyof VolunteerImportRow, number>> = {};
  header.forEach((h, i) => {
    const f = HEADER_ALIASES[h];
    if (f && idx[f] === undefined) idx[f] = i;
  });

  const body = rows.slice(1);
  const valid: VolunteerImportRow[] = [];
  let skipped = 0;
  for (const r of body) {
    const get = (f: keyof VolunteerImportRow) => (idx[f] !== undefined ? (r[idx[f]!] ?? "").trim() : "");
    const name = get("name");
    const email = get("email").toLowerCase();
    const phone = get("phone");
    if (!name || (!email && !phone)) {
      skipped++;
      continue;
    }
    valid.push({ name, email: email || undefined, phone: phone || undefined, city: get("city") || undefined, interests: get("interests") || undefined });
  }
  return { valid, skipped, total: body.length, mappedColumns: Object.keys(idx) as (keyof VolunteerImportRow)[] };
}

export type DonorImportRow = { name: string; email?: string; city?: string; state?: string; zip?: string; employer?: string; occupation?: string; amountCents?: number };

// Header → donor field. "amount" is special (parsed to cents).
const DONOR_HEADER_ALIASES: Record<string, string> = {
  name: "name", "full name": "name", fullname: "name", donor: "name", "donor name": "name", contact: "name",
  email: "email", "email address": "email", "e-mail": "email", emailaddress: "email",
  city: "city", town: "city",
  state: "state", st: "state", province: "state",
  zip: "zip", zipcode: "zip", "zip code": "zip", postal: "zip", "postal code": "zip",
  employer: "employer", company: "employer", organization: "employer",
  occupation: "occupation", job: "occupation", title: "occupation", profession: "occupation",
  amount: "amount", "amount $": "amount", contribution: "amount", gift: "amount", donation: "amount", total: "amount",
};

export type DonorMapResult = { valid: DonorImportRow[]; skipped: number; total: number; mappedColumns: string[] };

// Map parsed CSV rows (first row = header) into donor rows. Requires a name; an
// amount is optional (lets you import a donor contact list without gifts). FEC
// employer/occupation are carried through when present.
export function mapDonors(rows: string[][]): DonorMapResult {
  if (rows.length === 0) return { valid: [], skipped: 0, total: 0, mappedColumns: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx: Record<string, number> = {};
  header.forEach((h, i) => {
    const f = DONOR_HEADER_ALIASES[h];
    if (f && idx[f] === undefined) idx[f] = i;
  });

  const body = rows.slice(1);
  const valid: DonorImportRow[] = [];
  let skipped = 0;
  for (const r of body) {
    const get = (f: string) => (idx[f] !== undefined ? (r[idx[f]] ?? "").trim() : "");
    const name = get("name");
    if (!name) {
      skipped++;
      continue;
    }
    const amt = Number(get("amount").replace(/[$,\s]/g, ""));
    const amountCents = isFinite(amt) && amt > 0 ? Math.round(amt * 100) : undefined;
    valid.push({
      name,
      email: get("email").toLowerCase() || undefined,
      city: get("city") || undefined,
      state: get("state") || undefined,
      zip: get("zip") || undefined,
      employer: get("employer") || undefined,
      occupation: get("occupation") || undefined,
      amountCents,
    });
  }
  return { valid, skipped, total: body.length, mappedColumns: Object.keys(idx) };
}
