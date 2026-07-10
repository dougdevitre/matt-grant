"use server";

import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listVotersByPrecinct } from "@/lib/voters/store";
import type { StoredVoter } from "@/lib/voters/storeTypes";

// Server actions for the voter dashboard. viewVoterFile is ADMIN-ONLY (rbac):
// this is RSMo 115.157 data — captains get generated turf packets in Phase 4,
// never raw access. Every read re-gates server-side regardless of the UI.

async function allowed(): Promise<boolean> {
  const g = await staffGate();
  return g.ok && can(g.role, "viewVoterFile");
}

/** All voters in one precinct shard (bounded — a few thousand rows). The
 *  explorer filters + builds RSMo-stamped CSVs client-side from this. */
export async function fetchPrecinctVoters(precinctKey: string): Promise<StoredVoter[]> {
  if (!(await allowed())) return [];
  const key = String(precinctKey ?? "").trim().slice(0, 120);
  if (!key) return [];
  return listVotersByPrecinct(key);
}
