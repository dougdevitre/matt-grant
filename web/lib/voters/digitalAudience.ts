// Digital custom-audience export — PURE + testable. Turns voter-file rows into a
// SHA-256-HASHED Meta Custom Audience file (name + city + state + zip + country) so
// the campaign can run digital ads to voters it lawfully holds but cannot text.
//
// The output contains ONLY hashed match keys — no plaintext PII, no voterId — so it's
// privacy-preserving by construction. Uploading it for the campaign's OWN political ad
// targeting does NOT require the individual's consent (unlike SMS); it must stay
// political-use-only per RSMo 115.157 and follow the platform's advertiser terms.
//
// Meta hashes with SHA-256 after normalizing (lowercase, strip whitespace/punctuation).
// We pre-hash so raw PII never leaves the campaign. This module reads only the voter
// type + node:crypto — no store import — so it never touches lib/sms and doesn't widen
// the voter-file isolation surface.
import { createHash } from "node:crypto";

// Only the name+address fields Meta matches on — a StoredVoter satisfies this
// structurally, and the export script can build it from raw rows without importing
// the server-only voter store.
export type AudienceVoter = { firstName: string; lastName: string; city: string; zip: string };

/** Meta customer-list column identifiers, in order. All hashed for a name+address file. */
export const AUDIENCE_HEADERS = ["fn", "ln", "ct", "st", "zip", "country"] as const;

/** Normalize a name/city to Meta's rule: lowercase, keep a–z/0–9 only (drops spaces,
 *  punctuation, accents-as-stripped). "O'Brien" → "obrien", "Saint Louis" → "saintlouis". */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}

/** First 5 digits of a ZIP (US 5-digit form Meta expects). "63131-1234" → "63131". */
export function zip5(s: string | null | undefined): string {
  const d = (s ?? "").replace(/\D/g, "");
  return d.slice(0, 5);
}

/** SHA-256 hex of a value, or "" for an empty value — Meta wants a blank cell, not the
 *  hash of an empty string, when a field is missing. */
export function sha256hex(value: string): string {
  if (!value) return "";
  return createHash("sha256").update(value).digest("hex");
}

export type AudienceOpts = { state?: string; country?: string };
export type AudienceRow = { fn: string; ln: string; ct: string; st: string; zip: string; country: string };

/** One hashed audience row for a voter. `state`/`country` default to Missouri / US
 *  (the whole MO-02 file), normalized then hashed like every other field. */
export function audienceRow(v: AudienceVoter, opts: AudienceOpts = {}): AudienceRow {
  const st = normalizeName(opts.state ?? "MO"); // 2-letter, lowercased → "mo"
  const country = normalizeName(opts.country ?? "US"); // → "us"
  return {
    fn: sha256hex(normalizeName(v.firstName)),
    ln: sha256hex(normalizeName(v.lastName)),
    ct: sha256hex(normalizeName(v.city)),
    st: sha256hex(st),
    zip: sha256hex(zip5(v.zip)),
    country: sha256hex(country),
  };
}

const csvLine = (cells: readonly string[]) => cells.join(","); // hashes are [0-9a-f]; no commas/quotes to escape

/** Meta-ready hashed Custom Audience CSV: header row + one hashed row per voter. No
 *  RSMo banner line inside the file (that would break the platform upload — the notice
 *  goes to the script console + docs instead). */
export function audienceCsv(voters: AudienceVoter[], opts: AudienceOpts = {}): string {
  const lines = [csvLine(AUDIENCE_HEADERS)];
  for (const v of voters) {
    const r = audienceRow(v, opts);
    lines.push(csvLine([r.fn, r.ln, r.ct, r.st, r.zip, r.country]));
  }
  return lines.join("\n") + "\n";
}
