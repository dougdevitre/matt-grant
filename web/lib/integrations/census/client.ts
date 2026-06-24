// U.S. Census ACS 5-year client (api.census.gov). Public demographic data for
// MO-02 targeting. Free key at https://api.census.gov/data/key_signup.html —
// works without a key at low volume too. State FIPS for Missouri = 29.
export const censusEnabled = !!process.env.CENSUS_API_KEY;

export const ACS_YEAR = process.env.CENSUS_ACS_YEAR ?? "2023";
const YEAR = ACS_YEAR;
export const ACS_BASE = `https://api.census.gov/data/${YEAR}/acs/acs5`;
const BASE = ACS_BASE;

// Counties that make up (or overlap) MO-02 under the 2025 ENACTED map (in effect
// for the Aug 4 2026 primary; see lib/countySources.ts). FIPS within state 29:
// St. Louis (189), Jefferson (099), Washington (221), Crawford (055), Gasconade (073).
// (The earlier default — St. Charles/Warren/Franklin — pre-dated the 2025 remap and
// is no longer in MO-02. Override with CENSUS_MO02_COUNTIES if the map changes.)
const MO02_COUNTIES = (process.env.CENSUS_MO02_COUNTIES ?? "189,099,221,055,073").split(",").map((s) => s.trim());

// ACS variable codes → friendly keys.
export const VARS = {
  population: "B01003_001E",
  medianHouseholdIncome: "B19013_001E",
  medianAge: "B01002_001E",
  medianHomeValue: "B25077_001E",
  pop25Plus: "B15003_001E",
  // "Bachelor's or higher" = bachelor's + master's + professional + doctorate.
  // Using B15003_022E alone undercounts everyone with a graduate degree.
  eduBachelors: "B15003_022E",
  eduMasters: "B15003_023E",
  eduProfessional: "B15003_024E",
  eduDoctorate: "B15003_025E",
} as const;

export const EDU_VARS = [VARS.eduBachelors, VARS.eduMasters, VARS.eduProfessional, VARS.eduDoctorate];

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

export const acsNum = (v: string | null): number | null => {
  if (v == null) return null;
  const x = Number(v);
  // Census uses large negative sentinels (e.g. -666666666) for missing data.
  return Number.isFinite(x) && x > -100000000 ? x : null;
};
const n = acsNum;

export async function fetchMo02Acs(): Promise<CountyAcs[]> {
  const get = Object.values(VARS).join(",");
  const u = new URL(BASE);
  u.searchParams.set("get", `NAME,${get}`);
  u.searchParams.set("for", `county:${MO02_COUNTIES.join(",")}`);
  u.searchParams.set("in", "state:29");
  if (process.env.CENSUS_API_KEY) u.searchParams.set("key", process.env.CENSUS_API_KEY);

  const res = await fetch(u, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`census ${res.status}`);
  const rows = (await res.json()) as unknown;
  // Census returns a 2-D array; a bad variable/geo can yield HTML or {} instead.
  if (!Array.isArray(rows) || !Array.isArray(rows[0])) {
    throw new Error("census: unexpected response shape");
  }
  const [header, ...data] = rows as string[][];
  const idx = (k: string) => {
    const i = header.indexOf(k);
    if (i === -1) throw new Error(`census: missing column ${k}`);
    return i;
  };

  return (data as string[][]).map((r) => {
    const eduParts = EDU_VARS.map((v) => n(r[idx(v)]));
    const bachPlus = eduParts.some((x) => x != null) ? eduParts.reduce<number>((s, x) => s + (x ?? 0), 0) : null;
    const pop25 = n(r[idx(VARS.pop25Plus)]);
    const countyFips = r[idx("county")];
    return {
      name: r[idx("NAME")],
      countyFips,
      population: n(r[idx(VARS.population)]),
      medianHouseholdIncome: n(r[idx(VARS.medianHouseholdIncome)]),
      medianAge: n(r[idx(VARS.medianAge)]),
      medianHomeValue: n(r[idx(VARS.medianHomeValue)]),
      bachelorsPlusPct: bachPlus != null && pop25 ? Math.round((bachPlus / pop25) * 1000) / 10 : null,
      sourceUrl: `https://data.census.gov/profile?g=050XX00US29${countyFips}`,
    };
  });
}
