// Reads the campaign's letter-sized print queue (candidate/letters/print-tracker.csv)
// and writes a committed data-as-code manifest at lib/printTracker.json that the
// staff dashboard (/dashboard/print) reads. The CSV is the source of truth; the web
// bundle gets a parsed JSON so there's no CSV parser in the client.
//
//   npm run print-tracker      (tsx scripts/generate-print-tracker.ts)
//
// Uses the shared RFC-4180 parser in lib/data/csv.ts so quoted/comma-bearing fields
// are handled correctly — the old inline split silently broke on them.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCsv } from "../lib/data/csv";

const CSV = path.join(process.cwd(), "..", "candidate", "letters", "print-tracker.csv");
const OUT = path.join(process.cwd(), "lib", "printTracker.json");

async function main() {
  const text = await readFile(CSV, "utf8");
  const { columns, items } = parseCsv(text);
  const manifest = {
    generatedFrom: "candidate/letters/print-tracker.csv",
    columns,
    items,
  };
  await writeFile(OUT, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`✓ ${items.length} print items → lib/printTracker.json`);
}

main();
