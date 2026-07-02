// Reads the five St. Louis demographic CSVs (candidate/data/*.csv — U.S. Census
// Bureau 2025 Vintage age estimates, analysis by J.S. Sándoval, SLU) and writes
// committed data-as-code manifests to lib/demographics/*.json that the app reads.
// The CSVs are the source of truth; the web bundle gets validated JSON so there is
// no CSV parser in the client (same contract as generate-print-tracker.ts).
//
//   npm run demographics      (tsx scripts/generate-demographics.ts)
//
// Column mapping is BY POSITION on purpose: the source headers are inconsistent
// (BOM, a double space, an underscore) so index mapping is more robust than name
// matching. Values stay as trimmed strings; the zod loaders (lib/demographics/
// schema.ts) coerce + validate. No Date.now → deterministic, byte-stable output.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseCsvRows } from "../lib/data/csv";

const ROOT = path.join(process.cwd(), "..");
const DATA = path.join(ROOT, "candidate", "data");
const OUT = path.join(process.cwd(), "lib", "demographics");

type Spec = { csv: string; out: string; keys: string[] };

// keys[] map 1:1 to the source columns, in order.
const SPECS: Spec[] = [
  {
    csv: "children-under-15-by-county-2020-2025.csv",
    out: "childUnder15ByCounty.json",
    keys: ["county", "under15_2020", "under15_2025", "change", "pctChange"],
  },
  {
    csv: "children-under-5-decline-by-metro.csv",
    out: "under5DeclineByMetro.json",
    keys: ["metro", "declineUnder5", "pctDecline"],
  },
  {
    csv: "st-charles-age-structure-2020-2025.csv",
    out: "stCharlesAgeStructure.json",
    keys: ["ageGroup", "pop2020", "pop2025", "change"],
  },
  {
    csv: "aging-index-by-metro-2020-2025.csv",
    out: "agingIndexByMetro.json",
    keys: ["metro", "agingIndex2020", "agingIndex2025", "agingIndexChange", "agingIndexPctChange", "pct65plus2025"],
  },
  {
    csv: "msa-population-by-age-2020-2025.csv",
    out: "msaPopulationByAge.json",
    keys: ["ageGroup", "y2020", "y2021", "y2022", "y2023", "y2024", "y2025", "change"],
  },
];

async function build(spec: Spec) {
  const text = (await readFile(path.join(DATA, spec.csv), "utf8")).replace(/^﻿/, "");
  const rows = parseCsvRows(text).filter((r) => r.some((c) => c.trim().length > 0));
  const [, ...body] = rows; // drop the header row; we map by position
  const items = body.map((cells) => {
    const obj: Record<string, string> = {};
    spec.keys.forEach((k, i) => (obj[k] = (cells[i] ?? "").trim()));
    return obj;
  });
  const manifest = { generatedFrom: `candidate/data/${spec.csv}`, columns: spec.keys, items };
  await writeFile(path.join(OUT, spec.out), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`✓ ${items.length} rows → lib/demographics/${spec.out}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const spec of SPECS) await build(spec);
}

main();
