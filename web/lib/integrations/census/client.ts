// U.S. Census ACS 5-year client (api.census.gov). Public demographic data for
// MO-02 targeting. Free key at https://api.census.gov/data/key_signup.html —
// works without a key at low volume too. State FIPS for Missouri = 29.
export const censusEnabled = !!process.env.CENSUS_API_KEY;

const YEAR = process.env.CENSUS_ACS_YEAR ?? "2023";
const BASE = `https://api.census.gov/data/${YEAR}/acs/acs5`;

// Counties that make up (or overlap) MO-02. FIPS within state 29.
// St. Louis (189), St. Charles (183), Jefferson (099), Warren (219), Franklin (071).
const MO02_COUNTIES = (process.env.CENSUS_MO02_COUNTIES ?? "189,183,099,219,071").split(",").map((s) => s.trim());

// ACS variable codes → friendly keys.
const VARS = {
  population: "B01003_001E",
  medianHouseholdIncome: "B19013_001E",
  medianAge: "B01002_001E",
  medianHomeValue: "B25077_001E",
  bachelorsPlus: "B15003_022E", // bachelor's degree count (subset of 25+)
  pop25Plus: "B15003_001E",
} as const;

export type CountyAcs = {
  name: string;
  countyFips: string;
  population: number | null;
  medianHouseholdIncome: number | null;
  medianAge: number | null;
  medianHomeValue: number | null;
  bachelorsPlusPct: number | null;
  sourceUrl: string;
};

const n = (v: string | null): number | null => {
  if (v == null) return null;
  const x = Number(v);
  // Census uses large negative sentinels (e.g. -666666666) for missing data.
  return Number.isFinite(x) && x > -100000000 ? x : null;
};

export async function fetchMo02Acs(): Promise<CountyAcs[]> {
  const get = Object.values(VARS).join(",");
  const u = new URL(BASE);
  u.searchParams.set("get", `NAME,${get}`);
  u.searchParams.set("for", `county:${MO02_COUNTIES.join(",")}`);
  u.searchParams.set("in", "state:29");
  if (process.env.CENSUS_API_KEY) u.searchParams.set("key", process.env.CENSUS_API_KEY);

  const res = await fetch(u, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`census ${res.status}`);
  const rows = (await res.json()) as string[][];
  const [header, ...data] = rows;
  const idx = (k: string) => header.indexOf(k);

  return data.map((r) => {
    const bach = n(r[idx(VARS.bachelorsPlus)]);
    const pop25 = n(r[idx(VARS.pop25Plus)]);
    const countyFips = r[idx("county")];
    return {
      name: r[idx("NAME")],
      countyFips,
      population: n(r[idx(VARS.population)]),
      medianHouseholdIncome: n(r[idx(VARS.medianHouseholdIncome)]),
      medianAge: n(r[idx(VARS.medianAge)]),
      medianHomeValue: n(r[idx(VARS.medianHomeValue)]),
      bachelorsPlusPct: bach != null && pop25 ? Math.round((bach / pop25) * 1000) / 10 : null,
      sourceUrl: `https://data.census.gov/profile?g=050XX00US29${countyFips}`,
    };
  });
}
