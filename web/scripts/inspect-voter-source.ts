/**
 * Voter-source schema inspector — run with tsx:
 *
 *   npm run inspect:voter-source -- --file /tmp/voters/export.csv
 *   npx tsx scripts/inspect-voter-source.ts --file export.xlsx [--sample 20000]
 *   ... [--max-distinct 30] [--fast] [--out ../candidate/_source-schema.md]
 *
 * READ-ONLY. Touches no AWS resource and writes nothing but the optional --out
 * report. Its job is to answer "what columns does this export actually have?"
 * for a file too large to open by hand, so a source adapter can be written
 * against real column names instead of guesses.
 *
 * PRIVACY: prints SHAPES, never row values — see the masking rules in
 * lib/voters/sourceInspect.ts. No name, street address, phone number, or email
 * reaches stdout or the report file.
 *
 * The CSV path STREAMS, so memory stays flat regardless of file size and the row
 * count is exact (which is what makes the Excel-truncation check meaningful).
 * The xlsx path must buffer + parse and is bounded by --sample; prefer the CSV
 * (candidate/voter-registry-refresh-plan.md §2).
 */
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  makeCsvParser,
  newCol,
  observe,
  renderReport,
  sniffDelimiter,
  type ColStat,
  type ScanResult,
} from "../lib/voters/sourceInspect";

const args = process.argv.slice(2);
const opt = (name: string, dflt: string): string => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const flag = (name: string): boolean => args.includes(name);

/** Read a bounded prefix of the file — never the whole thing. */
function readHead(path: string, bytes: number): Promise<string> {
  return new Promise((res, rej) => {
    const chunks: string[] = [];
    const s = createReadStream(path, { encoding: "utf8", end: bytes });
    s.on("data", (c) => chunks.push(String(c)));
    s.on("close", () => res(chunks.join("")));
    s.on("end", () => res(chunks.join("")));
    s.on("error", rej);
  });
}

async function scanCsv(path: string, sample: number, distinctCap: number, fast: boolean): Promise<ScanResult> {
  const delimiter = sniffDelimiter(await readHead(path, 64 * 1024));

  let headers: string[] = [];
  let cols: ColStat[] = [];
  let totalRows = 0;
  let sampledRows = 0;
  let raggedRows = 0;

  const parser = makeCsvParser(delimiter, (row) => {
    if (headers.length === 0) {
      headers = row.map((h) => h.trim());
      cols = headers.map((h, i) => newCol(h, i));
      return;
    }
    totalRows++;
    if (row.length !== headers.length) raggedRows++;
    if (sampledRows < sample) {
      sampledRows++;
      for (let i = 0; i < cols.length; i++) observe(cols[i], row[i] ?? "", distinctCap);
    }
  });

  await new Promise<void>((res, rej) => {
    const stream = createReadStream(path, { encoding: "utf8" });
    stream.on("data", (chunk) => {
      parser.write(String(chunk));
      // --fast stops once the sample is full; the row count is then a lower bound.
      if (fast && sampledRows >= sample) stream.destroy();
    });
    stream.on("close", res);
    stream.on("end", res);
    stream.on("error", rej);
  });
  parser.end();

  return { headers, cols, totalRows, sampledRows, raggedRows, exactCount: !fast, delimiter };
}

async function scanXlsx(path: string, sample: number, distinctCap: number): Promise<ScanResult> {
  // Imported lazily so the CSV path (the recommended one) never pays for it.
  const XLSX = await import("xlsx");
  const buf = readFileSync(path);
  // sheetRows bounds the PARSE — without it SheetJS materializes every row as an
  // array and a large workbook exhausts memory (docs/VOTER-FILE.md low-mem note).
  const wb = XLSX.read(buf, { type: "buffer", dense: true, sheetRows: sample + 1, raw: true });
  const sheets = wb.SheetNames;
  const ws = wb.Sheets[sheets[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, blankrows: false });

  const headers = (rows[0] ?? []).map((h) => String(h ?? "").trim());
  const cols = headers.map((h, i) => newCol(h, i));
  let raggedRows = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (row.length !== headers.length) raggedRows++;
    for (let i = 0; i < cols.length; i++) observe(cols[i], String(row[i] ?? ""), distinctCap);
  }
  const sampledRows = Math.max(0, rows.length - 1);
  return { headers, cols, totalRows: sampledRows, sampledRows, raggedRows, exactCount: false, sheets };
}

async function main() {
  const file = opt("--file", "");
  if (!file) {
    console.error(
      "Usage: npx tsx scripts/inspect-voter-source.ts --file <path.csv|path.xlsx> " +
        "[--sample 50000] [--max-distinct 30] [--fast] [--out report.md]",
    );
    process.exit(1);
  }
  const path = resolve(file);
  const sample = Math.max(1, Number(opt("--sample", "50000")));
  const distinctCap = Math.max(1, Number(opt("--max-distinct", "30")));
  const fast = flag("--fast");
  const out = opt("--out", "");

  const isXlsx = /\.xlsx?$/i.test(path);
  if (isXlsx) {
    console.error(
      "NOTE: xlsx mode buffers and parses the workbook (bounded by --sample) and cannot report an exact row " +
        "count. Prefer the original CSV — it streams, counts exactly, and sidesteps Excel's row cap.",
    );
  }

  const result = isXlsx ? await scanXlsx(path, sample, distinctCap) : await scanCsv(path, sample, distinctCap, fast);

  if (result.headers.length === 0) {
    console.error("No header row found — is the file empty, or is the first row blank?");
    process.exit(1);
  }

  const report = renderReport(basename(path), result, distinctCap);
  if (out) {
    writeFileSync(resolve(out), `${report}\n`, "utf8");
    console.log(`Wrote ${out} (${result.headers.length} columns, ${result.totalRows.toLocaleString()} rows).`);
  } else {
    console.log(report);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
