/**
 * School-district crosswalk generator (candidate/sms-conversational-interface-plan.md §6).
 *
 *   npx tsx scripts/build-school-district-crosswalk.ts \
 *     --lea-county <path to NCES GRF district-to-county file (.xlsx/.csv/.txt)> \
 *     --lea-zcta   <path to NCES GRF district-to-ZCTA file   (.xlsx/.csv/.txt)> \
 *     --retrieved  YYYY-MM-DD   (the date the GRF files were downloaded)
 *     [--out lib/sms/school-districts.data.ts]
 *
 * Inputs are the NCES EDGE School District Geographic Relationship Files
 * (https://nces.ed.gov/programs/edge/geographic/relationshipfiles) — the federal
 * district↔county and district↔ZCTA crosswalk tables built from Census TIGER.
 * This script must run from a machine that has the files locally (the campaign's
 * remote sandbox cannot reach nces.ed.gov); it does NOT fetch anything.
 *
 * What it does:
 *   1. Reads the district↔county table and keeps Missouri districts (LEAID 29…)
 *      whose county is one of the six MO-02 counties — matched by EXACT county
 *      name, never "contains" ("St. Louis city" must not match "St. Louis County").
 *   2. Reads the district↔ZCTA table and keeps rows for those districts,
 *      producing ZIP → [LEAID…]. A ZIP with >1 district is kept as-is —
 *      downstream treats it as ambiguous rather than guessing.
 *   3. Overwrites lib/sms/school-districts.data.ts with the data + provenance.
 *
 * STOPS with an error (writes nothing) when the expected header columns are not
 * found — same fail-loud posture as the voter ingest. After generating, verify
 * the district display names against the Missouri DESE School Directory
 * (https://dese.mo.gov/directory) before any name appears in voter-facing text,
 * and record the update in references/update-log.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";

// The six MO-02 counties (2025 enacted map — candidate/voter-file-plan.md §5),
// matched by EXACT lowercase county name as spelled in the GRF files.
const MO02_COUNTIES: Record<string, string> = {
  "st. louis county": "st-louis",
  "franklin county": "franklin",
  "jefferson county": "jefferson",
  "washington county": "washington",
  "crawford county": "crawford",
  "gasconade county": "gasconade",
};

const args = process.argv.slice(2);
const opt = (name: string): string | null => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};

type Row = Record<string, unknown>;

function readTable(path: string): Row[] {
  const wb = XLSX.read(readFileSync(path), { type: "buffer" }); // xlsx + csv/txt both parse
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Row>(ws, { raw: false, defval: "" });
}

/** Find the actual column name matching one of the expected patterns, or die loudly. */
function col(rows: Row[], what: string, patterns: RegExp[]): string {
  const keys = Object.keys(rows[0] ?? {});
  const hit = keys.find((k) => patterns.some((p) => p.test(k.trim().toUpperCase())));
  if (!hit) {
    console.error(`HEADER MISMATCH: no ${what} column. Found headers: ${keys.join(", ")}`);
    console.error("Check you downloaded the right GRF table; nothing was written.");
    process.exit(1);
  }
  return hit;
}

function main() {
  const leaCountyPath = opt("--lea-county");
  const leaZctaPath = opt("--lea-zcta");
  const retrieved = opt("--retrieved");
  const out = opt("--out") ?? "lib/sms/school-districts.data.ts";
  if (!leaCountyPath || !leaZctaPath || !/^\d{4}-\d{2}-\d{2}$/.test(retrieved ?? "")) {
    console.error("Usage: --lea-county <file> --lea-zcta <file> --retrieved YYYY-MM-DD [--out path]");
    process.exit(1);
  }

  // 1) District ↔ county: Missouri LEAs in the six MO-02 counties.
  const countyRows = readTable(leaCountyPath);
  const cLea = col(countyRows, "LEAID", [/^LEAID$/]);
  const cLeaName = col(countyRows, "district name", [/^NAME_LEA/, /^LEA_NAME/, /^NAME$/]);
  const cCountyName = col(countyRows, "county name", [/^NAME_COUNTY/, /^COUNTY_NAME/, /^CNTY_NAME/]);
  const districts: Record<string, { name: string; counties: string[] }> = {};
  for (const r of countyRows) {
    const leaid = String(r[cLea] ?? "").trim();
    const countyKey = MO02_COUNTIES[String(r[cCountyName] ?? "").trim().toLowerCase()];
    if (!leaid.startsWith("29") || !countyKey) continue; // Missouri + MO-02 counties only
    const d = (districts[leaid] ??= { name: String(r[cLeaName] ?? "").trim(), counties: [] });
    if (!d.counties.includes(countyKey)) d.counties.push(countyKey);
  }
  if (Object.keys(districts).length === 0) {
    console.error("No MO-02 districts found — wrong file or unexpected county naming. Nothing written.");
    process.exit(1);
  }

  // 2) District ↔ ZCTA: ZIPs per kept district. Ambiguity (ZIP in >1 district)
  //    is preserved, not resolved.
  const zctaRows = readTable(leaZctaPath);
  const zLea = col(zctaRows, "LEAID", [/^LEAID$/]);
  const zZcta = col(zctaRows, "ZCTA", [/^ZCTA5/, /^ZCTA/]);
  const zipToDistricts: Record<string, string[]> = {};
  for (const r of zctaRows) {
    const leaid = String(r[zLea] ?? "").trim();
    if (!(leaid in districts)) continue;
    const zip = String(r[zZcta] ?? "").trim().slice(0, 5);
    if (!/^\d{5}$/.test(zip)) continue;
    const list = (zipToDistricts[zip] ??= []);
    if (!list.includes(leaid)) list.push(leaid);
  }

  // 3) Emit the data module (sorted keys → stable diffs) with full provenance.
  const sortObj = <T,>(o: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  const data = {
    source: {
      generator: "web/scripts/build-school-district-crosswalk.ts",
      leaCountyFile: leaCountyPath,
      leaZctaFile: leaZctaPath,
      retrievedAt: retrieved,
      urls: [
        "https://nces.ed.gov/programs/edge/geographic/relationshipfiles",
        "https://gis.mo.gov/arcgis/rest/services/DESE/Missouri_Public_Schools/MapServer",
        "https://dese.mo.gov/directory",
      ],
    },
    districts: sortObj(districts),
    zipToDistricts: sortObj(Object.fromEntries(Object.entries(zipToDistricts).map(([z, ids]) => [z, [...ids].sort()]))),
  };

  const ambiguous = Object.values(zipToDistricts).filter((ids) => ids.length > 1).length;
  const header = `// GENERATED by ${data.source.generator} — do not hand-edit (re-run the generator).
// Source: NCES EDGE GRF district-to-county + district-to-ZCTA tables (retrieved ${retrieved}).
// Verify district display names against the Missouri DESE School Directory
// (https://dese.mo.gov/directory) before voter-facing use, and log the update in
// references/update-log.md. ZIPs listed under >1 district are AMBIGUOUS by design.
export type SchoolDistrictDataFile = {
  source: {
    generator: string;
    leaCountyFile: string | null;
    leaZctaFile: string | null;
    retrievedAt: string | null;
    urls: string[];
  };
  districts: Record<string, { name: string; counties: string[] }>;
  zipToDistricts: Record<string, string[]>;
};

export const SCHOOL_DISTRICT_DATA: SchoolDistrictDataFile = `;
  const path = join(process.cwd(), out);
  writeFileSync(path, `${header}${JSON.stringify(data, null, 2)};\n`);

  console.log(`Districts: ${Object.keys(districts).length}`);
  console.log(`ZIPs mapped: ${Object.keys(zipToDistricts).length} (${ambiguous} ambiguous, kept as multi-district)`);
  console.log(`Wrote ${path}`);
  console.log("Next: verify names vs DESE directory, run the test suite, commit, then re-run enrich:sms.");
}

main();
