// Reads the campaign's letter-sized print queue (candidate/letters/print-tracker.csv)
// and writes a committed data-as-code manifest at lib/printTracker.json that the
// staff dashboard (/dashboard/print) reads. Same pattern as
// generate-print-renditions.mjs — the CSV is the source of truth; the web bundle
// gets a parsed JSON so there's no CSV parser in the client.
//
//   node scripts/generate-print-tracker.mjs
//
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CSV = path.join(process.cwd(), "..", "candidate", "letters", "print-tracker.csv");
const OUT = path.join(process.cwd(), "lib", "printTracker.json");

// Minimal CSV reader. The tracker has no quoted/comma-bearing fields (paths use
// "/", names use " / "), so a plain split is correct and dependency-free. If a
// field ever needs an embedded comma, quote it and upgrade this parser.
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    header.forEach((key, i) => {
      row[key] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

async function main() {
  const text = await readFile(CSV, "utf8");
  const header = text.replace(/\r\n/g, "\n").split("\n")[0].split(",");
  const items = parseCsv(text);
  const manifest = {
    generatedFrom: "candidate/letters/print-tracker.csv",
    columns: header,
    items,
  };
  await writeFile(OUT, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`✓ ${items.length} print items → lib/printTracker.json`);
}

main();
