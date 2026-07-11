// Vendor phone-append ingestion (voter-file-plan.md §6) — PURE mapping from a
// pasted CSV to validated append rows, so the import panel can preview counts
// client-side before the server action writes anything (contacts/import.ts
// pattern). The vendor DECISION stays with the campaign; this is the plumbing
// that makes a purchased file usable the day it arrives.
//
// TCPA boundary (absolute): appended numbers are MANUAL-DIAL call sheets only.
// They never enter the SMS pipeline — broadcast texting stays gated on the
// person's own opt-in in the consent ledger, never on a voter-file match.
//
// A row is usable only with a phone AND either a Voter ID (exact key — wins at
// match time) or a name + 5-digit ZIP (joins the conservative matchPhones pool).

export type AppendedPhone = {
  voterId?: string;
  name?: string;
  zip?: string; // ZIP5
  phone: string;
  source: string; // vendor/file label, for provenance
};

type Field = "voterId" | "name" | "zip" | "phone" | "source";

const HEADER_ALIASES: Record<string, Field> = {
  "voter id": "voterId", voterid: "voterId", voter_id: "voterId", id: "voterId",
  name: "name", "full name": "name", fullname: "name",
  zip: "zip", zip5: "zip", zipcode: "zip", "zip code": "zip", postal: "zip",
  phone: "phone", "phone number": "phone", mobile: "phone", cell: "phone", telephone: "phone", "cell phone": "phone",
  source: "source", vendor: "source", file: "source",
};

export type AppendMapResult = {
  valid: AppendedPhone[];
  skipped: { row: number; reason: string }[]; // 1-based data-row numbers
  total: number;
  mappedColumns: Field[];
};

const digits = (s: string) => s.replace(/\D/g, "");

/** Map parsed CSV rows (first row = header) into validated append rows. */
export function mapAppendRows(rows: string[][], defaultSource = "vendor-append"): AppendMapResult {
  if (rows.length < 2) return { valid: [], skipped: [], total: 0, mappedColumns: [] };
  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()]);
  const mappedColumns = [...new Set(header.filter((f): f is Field => Boolean(f)))];
  const valid: AppendedPhone[] = [];
  const skipped: { row: number; reason: string }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const get = (f: Field) => {
      const idx = header.indexOf(f);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };
    const phoneDigits = digits(get("phone"));
    if (phoneDigits.length < 10) {
      skipped.push({ row: i, reason: "no usable phone" });
      continue;
    }
    const voterId = get("voterId");
    const name = get("name");
    const zip = digits(get("zip")).slice(0, 5);
    if (!voterId && !(name && zip.length === 5)) {
      skipped.push({ row: i, reason: "needs a Voter ID or a name + 5-digit ZIP" });
      continue;
    }
    valid.push({
      ...(voterId ? { voterId: voterId.slice(0, 40) } : {}),
      ...(name ? { name: name.slice(0, 120) } : {}),
      ...(zip.length === 5 ? { zip } : {}),
      phone: get("phone").slice(0, 24),
      source: (get("source") || defaultSource).slice(0, 60),
    });
  }
  return { valid, skipped, total: rows.length - 1, mappedColumns };
}
