// MO-02 county demographics (Census ACS 5-year) wrapped in the Resource envelope —
// shared by /api/research/census and the dashboard read view (app/dashboard/data/[id])
// so both surface the same payload + provenance. Public data; keyless at low volume.
import { fetchMo02Acs, type CountyAcs } from "./client";
import { loadApi } from "@/lib/data/api";
import type { Resource } from "@/lib/data/resource";

export function loadCensusCounties(): Promise<Resource<CountyAcs[]>> {
  return loadApi<CountyAcs[]>(() => fetchMo02Acs(), {
    source: "Census ACS (MO-02 counties)",
    enabled: true, // works keyless at low volume
    fallback: [],
  });
}
