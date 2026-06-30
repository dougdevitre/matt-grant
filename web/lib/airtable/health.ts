// Airtable health probe for the dashboard "Setup & status" page. Unlike the read
// client (which swallows every error to []), this distinguishes the states an admin
// needs to act on: not configured, configured-but-no-access (the documented
// fail-closed mode — the runtime PAT must be granted the volunteer base), or live.
// A 1-record HEAD-ish GET against the volunteer roster base is the cheapest probe.
import "server-only";
import { getSecret } from "@/lib/ssm";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";

const API_ROOT = "https://api.airtable.com/v0";

export type AirtableHealthState = "live" | "setup" | "error";
export type AirtableHealth = { state: AirtableHealthState; detail: string };

export async function checkAirtableHealth(): Promise<AirtableHealth> {
  let key: string | undefined;
  try {
    key = (await getSecret("AIRTABLE_API_KEY")) ?? undefined;
  } catch {
    key = undefined;
  }
  if (!key) {
    return {
      state: "setup",
      detail: "Not set up. Add AIRTABLE_API_KEY (SSM) to mirror the volunteer roster to Airtable.",
    };
  }

  const base = AIRTABLE_BASES.volunteer;
  try {
    const res = await fetch(`${API_ROOT}/${base.id}/${base.tables.volunteers}?maxRecords=1`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (res.ok) return { state: "live", detail: "Connected — the volunteer roster base is reachable." };
    if (res.status === 401) {
      return { state: "error", detail: "The Airtable key is invalid or expired (401). Rotate AIRTABLE_API_KEY." };
    }
    if (res.status === 403 || res.status === 404) {
      return {
        state: "error",
        detail: `Key set but can't reach the volunteer base (${res.status}). Grant the PAT access to base ${base.id}.`,
      };
    }
    return { state: "error", detail: `Airtable returned ${res.status}. The roster mirror may be degraded.` };
  } catch {
    return { state: "error", detail: "Couldn't reach Airtable just now. The roster mirror may be degraded." };
  }
}
