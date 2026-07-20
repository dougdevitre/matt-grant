// GENERATED DATA SHELL — school-district crosswalk for the six MO-02 counties.
//
// ⚠ NOT YET POPULATED. Per the no-invented-facts rule (CLAUDE.md), no district
// name or ZIP mapping is hand-typed here. Populate by running the generator
// against the two NCES EDGE School District Geographic Relationship Files
// (district↔county and district↔ZCTA), downloaded from:
//   https://nces.ed.gov/programs/edge/geographic/relationshipfiles
// then verify district display names against the Missouri DESE School Directory
// (https://dese.mo.gov/directory) / the DESE boundary layer
// (https://gis.mo.gov/arcgis/rest/services/DESE/Missouri_Public_Schools/MapServer,
// layer 1) before any name is used in voter-facing text:
//
//   npx tsx scripts/build-school-district-crosswalk.ts \
//     --lea-county <grf_lea_county file> --lea-zcta <grf_lea_zcta file> \
//     --retrieved YYYY-MM-DD
//
// The generator overwrites this file with real data + full provenance. Until
// then every consumer treats the crosswalk as absent (SCHOOL_DISTRICT_DATA_READY
// is false, district targeting chips stay hidden, enrichment writes no district).
export type SchoolDistrictDataFile = {
  source: {
    generator: string;
    leaCountyFile: string | null;
    leaZctaFile: string | null;
    retrievedAt: string | null; // when the GRF files were downloaded
    urls: string[];
  };
  /** NCES LEAID → { name, counties (CountyKey[]) } for districts in MO-02 counties. */
  districts: Record<string, { name: string; counties: string[] }>;
  /** ZIP5 (ZCTA) → LEAIDs it touches. >1 entry = the ZIP crosses district lines. */
  zipToDistricts: Record<string, string[]>;
};

export const SCHOOL_DISTRICT_DATA: SchoolDistrictDataFile = {
  source: {
    generator: "web/scripts/build-school-district-crosswalk.ts",
    leaCountyFile: null,
    leaZctaFile: null,
    retrievedAt: null,
    urls: [
      "https://nces.ed.gov/programs/edge/geographic/relationshipfiles",
      "https://gis.mo.gov/arcgis/rest/services/DESE/Missouri_Public_Schools/MapServer",
      "https://dese.mo.gov/directory",
    ],
  },
  districts: {},
  zipToDistricts: {},
};
