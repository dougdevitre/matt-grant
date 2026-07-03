// Place-level + ZCTA Census ACS5 client — the new geo source for per-district
// event insights. Extends the county-level client (./client.ts) so events located
// in a MO-02 *city* (Chesterfield, Ballwin, Kirkwood, …) get demographics at the
// place level, not just the county. Reuses the audited VARS/EDU_VARS/acsNum/BASE.
//
// Verified Census ACS5 2023 geography quirks:
//   • `place` nests in `state`  → for=place:*&in=state:29        (valid)
//   • `zip code tabulation area` does NOT nest in state in 2023  → for=zip…  with
//     NO `in=` clause (adding it returns "unknown/unsupported geography hierarchy").
import { ACS_BASE, VARS, EDU_VARS, acsNum, householdsWithChildrenPct } from "./client";
import { fetchJsonWithRetry } from "@/lib/integrations/http";

export type PlaceAcs = {
  name: string; // Census label, e.g. "Chesterfield city, Missouri"
  placeFips: string;
  population: number | null;
  medianHouseholdIncome: number | null;
  medianAge: number | null;
  medianHomeValue: number | null;
  bachelorsPlusPct: number | null;
  householdsWithChildrenPct: number | null;
  sourceUrl: string;
};

export type ZctaAcs = Omit<PlaceAcs, "name" | "placeFips"> & { zcta: string };

const GET = `NAME,${Object.values(VARS).join(",")}`;

// Pure URL builders (no key) — extracted so the verified geography shapes are
// unit-testable without a network call. The live fetch appends `key` when set.
export function placeAcsUrl(): string {
  const u = new URL(ACS_BASE);
  u.searchParams.set("get", GET);
  u.searchParams.set("for", "place:*");
  u.searchParams.set("in", "state:29"); // place DOES nest in state
  return u.toString();
}

export function zctaAcsUrl(zctas: string[]): string {
  const u = new URL(ACS_BASE);
  u.searchParams.set("get", GET);
  // ZCTA does NOT nest in state for 2023 ACS5 — query bare, no `in=`.
  u.searchParams.set("for", `zip code tabulation area:${zctas.join(",")}`);
  return u.toString();
}

function rows(json: unknown): { header: string[]; data: string[][] } {
  if (!Array.isArray(json) || !Array.isArray(json[0])) {
    throw new Error("census: unexpected response shape");
  }
  const [header, ...data] = json as string[][];
  return { header, data };
}

function bachelorsPlus(header: string[], r: string[]): number | null {
  const idx = (k: string) => header.indexOf(k);
  const eduParts = EDU_VARS.map((v) => acsNum(r[idx(v)]));
  const bach = eduParts.some((x) => x != null) ? eduParts.reduce<number>((s, x) => s + (x ?? 0), 0) : null;
  const pop25 = acsNum(r[idx(VARS.pop25Plus)]);
  return bach != null && pop25 ? Math.round((bach / pop25) * 1000) / 10 : null;
}

function common(header: string[], r: string[]) {
  const idx = (k: string) => header.indexOf(k);
  return {
    population: acsNum(r[idx(VARS.population)]),
    medianHouseholdIncome: acsNum(r[idx(VARS.medianHouseholdIncome)]),
    medianAge: acsNum(r[idx(VARS.medianAge)]),
    medianHomeValue: acsNum(r[idx(VARS.medianHomeValue)]),
    bachelorsPlusPct: bachelorsPlus(header, r),
    householdsWithChildrenPct: householdsWithChildrenPct(acsNum(r[idx(VARS.hhTotal)]), acsNum(r[idx(VARS.hhWithMinors)])),
  };
}

// All incorporated places in Missouri (state 29), one request. The caller matches
// the MO-02 cities by name (avoids hard-coding brittle place FIPS). Throws on a bad
// response so callers can fall back to county data.
export async function fetchMoPlaceAcs(): Promise<PlaceAcs[]> {
  const u = new URL(placeAcsUrl());
  if (process.env.CENSUS_API_KEY) u.searchParams.set("key", process.env.CENSUS_API_KEY);
  // Shared transport: hard timeout + bounded retry (the raw fetch had neither, so a
  // hung Census socket rode maxDuration to a 502 — see lib/integrations/http.ts).
  const { header, data } = rows(await fetchJsonWithRetry<unknown>(u, { headers: { accept: "application/json" }, label: "census place" }));
  const idx = (k: string) => header.indexOf(k);
  return data.map((r) => {
    const placeFips = r[idx("place")];
    return {
      name: r[idx("NAME")],
      placeFips,
      ...common(header, r),
      sourceUrl: `https://data.census.gov/profile?g=160XX00US29${placeFips}`,
    };
  });
}

// Demographics for specific ZCTAs (5-digit). Used only when an event location has a
// ZIP but no matching place. Throws on a bad response.
export async function fetchZctaAcs(zctas: string[]): Promise<ZctaAcs[]> {
  if (!zctas.length) return [];
  const u = new URL(zctaAcsUrl(zctas));
  if (process.env.CENSUS_API_KEY) u.searchParams.set("key", process.env.CENSUS_API_KEY);
  // Shared transport: hard timeout + bounded retry (see fetchMoPlaceAcs above).
  const { header, data } = rows(await fetchJsonWithRetry<unknown>(u, { headers: { accept: "application/json" }, label: "census zcta" }));
  const idx = (k: string) => header.indexOf(k);
  return data.map((r) => {
    const zcta = r[idx("zip code tabulation area")] ?? r[header.length - 1];
    return {
      zcta,
      ...common(header, r),
      sourceUrl: `https://data.census.gov/profile?g=860XX00US${zcta}`,
    };
  });
}
