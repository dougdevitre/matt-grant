// Airtable health probe for the dashboard "Setup & status" page. Unlike the read
// client (which swallows every error to []), this distinguishes the states an admin
// needs to act on: not configured, configured-but-no-access (the documented
// fail-closed mode — the runtime PAT must be granted the volunteer base), or live.
// A 1-record HEAD-ish GET against the volunteer roster base is the cheapest probe.
import "server-only";
import { getSecret } from "@/lib/ssm";
import { AIRTABLE_BASES, type BaseKey } from "@/lib/airtable/registry";

const API_ROOT = "https://api.airtable.com/v0";

export type AirtableHealthState = "live" | "setup" | "error";
export type AirtableHealth = { state: AirtableHealthState; detail: string };

// Probe a single base's reachability with the workspace PAT. Unlike the read
// client (which swallows every error to []), this distinguishes the states an
// admin needs to act on: not configured, configured-but-no-access (the
// documented fail-closed mode), or live. We hit the base's "Front-End Access"
// control table (every base is guaranteed one — see governance.test.ts) with a
// 1-record read, the cheapest base-agnostic probe.
export async function checkAirtableBaseHealth(baseKey: BaseKey): Promise<AirtableHealth> {
  let key: string | undefined;
  try {
    key = (await getSecret("AIRTABLE_API_KEY")) ?? undefined;
  } catch {
    key = undefined;
  }
  if (!key) {
    return {
      state: "setup",
      detail: "Not set up. Add AIRTABLE_API_KEY (SSM /matt-grant/AIRTABLE_API_KEY) to reach this base.",
    };
  }

  const base = AIRTABLE_BASES[baseKey];
  try {
    const res = await fetch(`${API_ROOT}/${base.id}/${base.accessTable}?maxRecords=1`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (res.ok) return { state: "live", detail: `Connected — base ${base.id} is reachable.` };
    if (res.status === 401) {
      return { state: "error", detail: "The Airtable key is invalid or expired (401). Rotate AIRTABLE_API_KEY." };
    }
    if (res.status === 403 || res.status === 404) {
      return {
        state: "error",
        detail: `Key set but can't reach base ${base.id} (${res.status}). Grant the PAT access to this base.`,
      };
    }
    return { state: "error", detail: `Airtable returned ${res.status}. This base may be degraded.` };
  } catch {
    return { state: "error", detail: "Couldn't reach Airtable just now. This base may be degraded." };
  }
}

// Back-compat: the dashboard "Setup & status" surfaces still check the volunteer
// roster base specifically (lib/dashboardStatus.ts, app/dashboard/volunteers).
export async function checkAirtableHealth(): Promise<AirtableHealth> {
  return checkAirtableBaseHealth("volunteer");
}
