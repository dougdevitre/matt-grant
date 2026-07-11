// Matched-phone lookup for call sheets (voter-file-plan.md Phase 4 / §6).
// The voter file carries NO phones; the ONLY numbers we attach are ones the
// campaign already holds — volunteers and donors who gave us their number —
// matched conservatively by full name + ZIP5. Matched numbers are for MANUAL
// DIAL call sheets only: broadcast texting stays gated on the person's own
// opt-in in the consent ledger, never on a voter-file match (TCPA). Pure.
import type { StoredVoter } from "./storeTypes";

export type PhoneContact = { name: string; zip?: string | null; phone?: string | null };

const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const zip5 = (s: string | null | undefined) => (s ?? "").trim().slice(0, 5);

const key = (name: string, zip: string | null | undefined) => {
  const n = normName(name);
  const z = zip5(zip);
  return n && z.length === 5 ? `${n}|${z}` : null;
};

/**
 * voterId → phone for voters whose full name + ZIP5 matches exactly one
 * campaign contact with a phone. A key claimed by two contacts with DIFFERENT
 * phones is ambiguous and dropped — a wrong number is worse than no number.
 */
export function matchPhones(voters: StoredVoter[], contacts: PhoneContact[]): Record<string, string> {
  const byKey = new Map<string, string | null>(); // null = ambiguous, never match
  for (const c of contacts) {
    const phone = (c.phone ?? "").trim();
    if (!phone) continue;
    const k = key(c.name, c.zip);
    if (!k) continue;
    const prev = byKey.get(k);
    if (prev === undefined) byKey.set(k, phone);
    else if (prev !== null && prev !== phone) byKey.set(k, null);
  }
  const out: Record<string, string> = {};
  for (const v of voters) {
    const k = key(`${v.firstName} ${v.lastName}`, v.zip);
    if (!k) continue;
    const phone = byKey.get(k);
    if (phone) out[v.voterId] = phone;
  }
  return out;
}
