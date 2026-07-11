"use server";

import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getDonors, getVolunteers } from "@/lib/queries";
import { matchPhones, type PhoneContact } from "@/lib/voters/phones";
import { listVotersByPrecinct } from "@/lib/voters/store";
import type { StoredVoter } from "@/lib/voters/storeTypes";

// Server actions for the voter dashboard. viewVoterFile is ADMIN-ONLY (rbac):
// this is RSMo 115.157 data — captains get generated turf packets in Phase 4,
// never raw access. Every read re-gates server-side regardless of the UI.

async function allowed(): Promise<boolean> {
  const g = await staffGate();
  return g.ok && can(g.role, "viewVoterFile");
}

export type PrecinctVoters = {
  voters: StoredVoter[];
  // voterId → phone matched from campaign records (volunteers/donors who gave
  // us their number), name+ZIP5, unambiguous only. MANUAL-DIAL call sheets
  // only — texting stays consent-ledger-gated (voter-file-plan.md §6).
  phones: Record<string, string>;
};

/** All voters in one precinct shard (bounded — a few thousand rows) plus
 *  matched phones. The explorer filters, cuts walk turfs, and builds the
 *  RSMo-stamped CSVs client-side from this. */
export async function fetchPrecinctVoters(precinctKey: string): Promise<PrecinctVoters> {
  if (!(await allowed())) return { voters: [], phones: {} };
  const key = String(precinctKey ?? "").trim().slice(0, 120);
  if (!key) return { voters: [], phones: {} };
  const voters = await listVotersByPrecinct(key);
  let phones: Record<string, string> = {};
  try {
    const [vols, donors] = await Promise.all([getVolunteers(), getDonors()]);
    const contacts: PhoneContact[] = [
      ...vols.rows.map((v) => ({ name: v.name, zip: v.zip, phone: v.phone })),
      ...donors.rows.map((d) => ({ name: d.name, zip: d.zip, phone: d.phone })),
    ];
    phones = matchPhones(voters, contacts);
  } catch {
    // Best-effort: no matches beats no voters.
  }
  return { voters, phones };
}
