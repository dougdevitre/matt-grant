// Pure normalizer for the DESE "Missouri Public Schools" feed (lib/geoSources
// SCHOOLS). The endpoint's exact field names couldn't be pre-verified from the
// build sandbox, so this resolves each property from a candidate list and
// returns null for any feature it can't confidently read — the route treats
// "nothing normalized" as "no live data" and keeps the sample layer. A wrong
// guess here can therefore never mislabel the map; it can only leave it on
// sample until the candidate lists are corrected against the real payload.

import type { PoiFeature } from "@/lib/geoSources";

// Common ArcGIS field spellings for a school's name / district / city, in
// priority order. Extend from a real payload if none match (the route's meta
// will show schoolsLive:false until then).
const NAME_FIELDS = ["SCHOOL_NAME", "School_Name", "SchoolName", "FACILITY_NAME", "Facility_Name", "NAME", "Name", "SCHOOL"];
const DISTRICT_FIELDS = ["DISTRICT_NAME", "District_Name", "DISTRICT", "District", "LEA_NAME", "LEA"];
const CITY_FIELDS = ["CITY", "City", "TOWN", "MAILING_CITY"];

function pickField(props: Record<string, unknown>, candidates: string[]): string | undefined {
  for (const key of candidates) {
    const v = props[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/** One feed feature → a schools POI, or null when it can't be read confidently. */
export function normalizeSchoolFeature(f: GeoJSON.Feature): PoiFeature | null {
  if (f.geometry?.type !== "Point") return null;
  const [lng, lat] = (f.geometry.coordinates ?? []) as number[];
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const props = (f.properties ?? {}) as Record<string, unknown>;
  const name = pickField(props, NAME_FIELDS);
  if (!name) return null;
  const note = [pickField(props, DISTRICT_FIELDS), pickField(props, CITY_FIELDS)].filter(Boolean).join(" · ") || undefined;
  return {
    type: "Feature",
    properties: { name, category: "schools", note, source: "live" },
    geometry: { type: "Point", coordinates: [lng, lat] },
  };
}
