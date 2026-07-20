// School-district crosswalk for MO-02 (candidate/sms-conversational-interface-plan.md §6).
//
// A DERIVED geography: the voter file has no school-district column, so district
// comes from a sourced ZIP(ZCTA)↔district crosswalk generated from NCES EDGE
// relationship files and name-verified against Missouri DESE (see
// school-districts.data.ts for provenance and the generator command). Static
// reference data only — this module reads NOTHING from the voter file, so the
// TCPA isolation guard (audiences.voterfile-isolation.test.ts) stays intact.
//
// The honest limitation, encoded in the API: ZIPs cross district lines. A ZIP
// mapping to more than one district is AMBIGUOUS — districtForZipUnambiguous()
// returns null for it, and nothing downstream ever presents an ambiguous match
// as certain. Per CLAUDE.md, district targeting is for geographic relevance
// (nearest early-vote site, events, turf) — never to imply local education
// policy positions beyond candidate/platform.md.
import { SCHOOL_DISTRICT_DATA, type SchoolDistrictDataFile } from "./school-districts.data";

export type SchoolDistrict = { id: string; name: string; counties: string[] };

const toDistricts = (data: SchoolDistrictDataFile): Record<string, SchoolDistrict> =>
  Object.fromEntries(
    Object.entries(data.districts).map(([id, d]) => [id, { id, name: d.name, counties: d.counties }]),
  );

/** LEAID-keyed registry of MO-02 school districts (empty until the crosswalk is generated). */
export const SCHOOL_DISTRICTS: Record<string, SchoolDistrict> = toDistricts(SCHOOL_DISTRICT_DATA);

/** True once the generated crosswalk is in place — consumers hide district features until then. */
export const SCHOOL_DISTRICT_DATA_READY = Object.keys(SCHOOL_DISTRICTS).length > 0;

export function districtById(id: string | null | undefined, data?: SchoolDistrictDataFile): SchoolDistrict | null {
  if (!id) return null;
  const reg = data ? toDistricts(data) : SCHOOL_DISTRICTS;
  return reg[id] ?? null;
}

/** Every district a ZIP touches: [] = unknown ZIP, length 1 = certain, >1 = ambiguous. */
export function districtsForZip(zip5: string, data: SchoolDistrictDataFile = SCHOOL_DISTRICT_DATA): SchoolDistrict[] {
  const ids = data.zipToDistricts[(zip5 ?? "").trim().slice(0, 5)] ?? [];
  const reg = data === SCHOOL_DISTRICT_DATA ? SCHOOL_DISTRICTS : toDistricts(data);
  return ids.map((id) => reg[id]).filter((d): d is SchoolDistrict => !!d);
}

/** The district for a ZIP only when it is certain — ambiguous/unknown ZIPs → null. */
export function districtForZipUnambiguous(zip5: string, data?: SchoolDistrictDataFile): string | null {
  const ds = districtsForZip(zip5, data);
  return ds.length === 1 ? ds[0].id : null;
}
