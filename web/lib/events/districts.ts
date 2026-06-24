// Canonical MO-02 district/area model for the event calendar. Every event resolves
// to a districtKey so its location ties to demographics + a cached insight blurb.
//
// Granularity: the 2025 ENACTED-map counties (see lib/countySources.ts) as the base
// units, with a city overlay for the populous St. Louis County suburbs where events
// actually happen. We key cities by NORMALIZED NAME (not place FIPS) because the
// Census place lookup (lib/integrations/census/places.ts) matches on name — avoiding
// brittle hand-keyed FIPS. A city with no Census match degrades to its county.

export type DistrictKind = "place" | "county" | "district";
export type DistrictRef = { key: string; label: string; kind: DistrictKind; county: string };

// Enacted MO-02 counties (state 29). FIPS → display name.
export const MO02_COUNTY_FIPS: Record<string, string> = {
  "189": "St. Louis County",
  "099": "Jefferson County",
  "221": "Washington County",
  "055": "Crawford County",
  "073": "Gasconade County",
};

// MO-02 city overlay → home county FIPS. Names mirror lib/actions.ts AREA_SUGGESTIONS
// plus a few high-traffic suburbs. Used for place-level demographics + display.
export const MO02_CITIES: { name: string; county: string }[] = [
  { name: "Chesterfield", county: "189" },
  { name: "Wildwood", county: "189" },
  { name: "Ballwin", county: "189" },
  { name: "Ellisville", county: "189" },
  { name: "Eureka", county: "189" },
  { name: "Town and Country", county: "189" },
  { name: "Kirkwood", county: "189" },
  { name: "Des Peres", county: "189" },
  { name: "Manchester", county: "189" },
  { name: "Maryland Heights", county: "189" },
  { name: "Valley Park", county: "189" },
  { name: "Arnold", county: "099" }, // Jefferson County
  { name: "Festus", county: "099" },
  { name: "Hillsboro", county: "099" },
  { name: "Potosi", county: "221" }, // Washington County
  { name: "Cuba", county: "055" }, // Crawford County
  { name: "Steelville", county: "055" },
  { name: "Hermann", county: "073" }, // Gasconade County
];

export const DISTRICT_FALLBACK_KEY = "district:mo-02";

/** Normalize a place name for matching: lowercase, collapse whitespace, drop punctuation. */
export function normPlace(name: string): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const CITY_BY_NORM = new Map(MO02_CITIES.map((c) => [normPlace(c.name), c]));
// County display-name (lowercased, "county" stripped) → FIPS, for matching free text.
const COUNTY_BY_NAME = new Map(
  Object.entries(MO02_COUNTY_FIPS).map(([fips, name]) => [normPlace(name.replace(/ County$/i, "")), fips]),
);

function countyFromText(county?: string): string | null {
  const t = normPlace(String(county ?? "").replace(/ County$/i, ""));
  return t ? (COUNTY_BY_NAME.get(t) ?? null) : null;
}

/** Resolve an event location to its district. City match → place; else county; else the MO-02 catch-all. */
export function resolveDistrict(loc: { city?: string; county?: string }): DistrictRef {
  const city = CITY_BY_NORM.get(normPlace(loc.city ?? ""));
  if (city) return { key: `place:${normPlace(city.name)}`, label: city.name, kind: "place", county: city.county };

  const fips = countyFromText(loc.county) ?? (city ? (city as { county: string }).county : null);
  if (fips) return { key: `county:${fips}`, label: MO02_COUNTY_FIPS[fips], kind: "county", county: fips };

  return { key: DISTRICT_FALLBACK_KEY, label: "MO-02 (district-wide)", kind: "district", county: "" };
}

/** Human label for a districtKey (for panels/lists that only have the key). */
export function districtLabel(key: string): string {
  if (key === DISTRICT_FALLBACK_KEY) return "MO-02 (district-wide)";
  if (key.startsWith("county:")) return MO02_COUNTY_FIPS[key.slice(7)] ?? "MO-02";
  if (key.startsWith("place:")) {
    const norm = key.slice(6);
    const city = MO02_CITIES.find((c) => normPlace(c.name) === norm);
    return city?.name ?? norm.replace(/\b\w/g, (m) => m.toUpperCase());
  }
  return "MO-02";
}

/** The home county FIPS for a districtKey (place → its county; county → itself; else ""). */
export function countyOf(key: string): string {
  if (key.startsWith("county:")) return key.slice(7);
  if (key.startsWith("place:")) {
    const city = MO02_CITIES.find((c) => normPlace(c.name) === key.slice(6));
    return city?.county ?? "";
  }
  return "";
}

/** Every districtKey worth precomputing an insight for (cron seed list). */
export function allDistrictKeys(): string[] {
  return [
    DISTRICT_FALLBACK_KEY,
    ...Object.keys(MO02_COUNTY_FIPS).map((f) => `county:${f}`),
    ...MO02_CITIES.map((c) => `place:${normPlace(c.name)}`),
  ];
}
