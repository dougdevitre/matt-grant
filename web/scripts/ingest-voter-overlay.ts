/**
 * Vendor-source OVERLAY ingest (candidate/voter-registry-refresh-plan.md §3) —
 * run with tsx:
 *
 *   DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 \
 *     npx tsx scripts/ingest-voter-overlay.ts --file /tmp/voters/vendor.csv --dry-run
 *   ... then the same command without --dry-run
 *
 * Loads a SECOND voter-file source (a commercial / party-committee export) as an
 * overlay on the official Sunshine-law spine: primary vote history and an
 * inferred party, joined by official voter ID.
 *
 * What this does NOT do, deliberately:
 *   • It never writes VOTER# rows. The official file remains the registration
 *     spine and the district denominator.
 *   • It never recomputes VOTERAGG. Those rollups are rebuilt wholesale from the
 *     official files; folding a filtered (e.g. Republican-only) universe into
 *     them would corrupt the district census and the chase board's math.
 *   • It never writes phone numbers into anything the SMS pipeline can read.
 *     Vendor phones are manual-dial / P2P only (voter-file-plan.md §2.3) AND are
 *     gated on written license terms — this script refuses to load them without
 *     --with-phones, which an operator passes only once that gate has cleared.
 *
 * Run `npm run inspect:voter-source -- --file <csv>` FIRST and confirm the
 * adapter's field mapping against the real header row.
 *
 * Streams the CSV, so a multi-gigabyte export costs flat memory. Prefer the
 * original CSV over an xlsx re-save: Excel silently truncates at 1,048,576 rows.
 */
import { createReadStream } from "node:fs";
import { basename, resolve } from "node:path";
import { PK, TABLE, queryAllPages } from "../lib/db";
import { makeCsvParser, sniffDelimiter } from "../lib/voters/sourceInspect";
import { precinctKey } from "../lib/voters/crosswalk";
import { detectSource } from "../lib/voters/sources";
import {
  detectDncColumn,
  mapVendorRow,
  resolveColumns,
  type ResolvedColumns,
  type VendorOverlayRecord,
} from "../lib/voters/sources/vendorRepub";
import { putOverlayRows } from "../lib/voters/overlayStore";

const args = process.argv.slice(2);
const opt = (name: string, dflt: string): string => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const flag = (name: string): boolean => args.includes(name);

const readHead = (path: string, bytes: number): Promise<string> =>
  new Promise((res, rej) => {
    const chunks: string[] = [];
    const s = createReadStream(path, { encoding: "utf8", end: bytes });
    s.on("data", (c) => chunks.push(String(c)));
    s.on("close", () => res(chunks.join("")));
    s.on("end", () => res(chunks.join("")));
    s.on("error", rej);
  });

type Stats = {
  rows: number;
  mapped: number;
  skippedUnusable: number; // no geography or no join key
  noVoterId: number; // name+ZIP-only rows (not written — see the note below)
  withPp: number;
  withParty: number;
  precincts: number;
  phonesSeen: number;
};

async function main() {
  const file = opt("--file", "");
  if (!file) {
    console.error(
      "Usage: npx tsx scripts/ingest-voter-overlay.ts --file <path.csv> [--dry-run] [--limit N] [--with-phones]",
    );
    process.exit(1);
  }
  const path = resolve(file);
  const dryRun = flag("--dry-run");
  const withPhones = flag("--with-phones");
  const limit = Number(opt("--limit", "0")) || Number.POSITIVE_INFINITY;
  const source = opt("--source-label", basename(path));

  if (!dryRun && !TABLE) {
    console.error("Set DYNAMODB_TABLE (or pass --dry-run to parse without writing).");
    process.exit(1);
  }

  const delimiter = sniffDelimiter(await readHead(path, 64 * 1024));

  let headers: string[] = [];
  let resolved: ResolvedColumns | null = null;
  let dncColumn: number | undefined;
  let headerError: string[] | null = null;

  // Bucket by precinct so writes go one partition at a time, matching how the
  // spine is sharded. Only voterId-keyed rows are accumulated (see below).
  const byPrecinct = new Map<string, Array<{ voterId: string; pp?: number; party?: string; source: string }>>();
  const stats: Stats = {
    rows: 0,
    mapped: 0,
    skippedUnusable: 0,
    noVoterId: 0,
    withPp: 0,
    withParty: 0,
    precincts: 0,
    phonesSeen: 0,
  };

  const parser = makeCsvParser(delimiter, (row) => {
    if (headers.length === 0) {
      headers = row.map((h) => h.trim());
      const detected = detectSource(headers);
      if (!detected.ok) {
        headerError = detected.problems;
        return;
      }
      if (detected.source !== "vendorRepub") {
        headerError = [
          `this file is the ${detected.source} source, not an overlay — load it with scripts/ingest-voters.ts instead.`,
        ];
        return;
      }
      const r = resolveColumns(headers);
      if (!r.ok) {
        headerError = r.problems;
        return;
      }
      resolved = { map: r.map, primaryColumns: r.primaryColumns, phoneColumns: r.phoneColumns };
      dncColumn = detectDncColumn(headers);
      return;
    }
    if (headerError || !resolved || stats.rows >= limit) return;
    stats.rows++;

    const rec: VendorOverlayRecord | null = mapVendorRow(row, resolved, { dncColumn });
    if (!rec) {
      stats.skippedUnusable++;
      return;
    }
    stats.mapped++;
    stats.phonesSeen += rec.phones.length;
    if (rec.pp !== undefined) stats.withPp++;
    if (rec.party) stats.withParty++;

    if (!rec.voterId) {
      // Name+ZIP-only rows can't be written directly: the overlay is keyed by the
      // spine's Voter ID, and resolving a name+ZIP to an ID needs the conservative
      // matcher (ambiguous keys dropped). Counted and reported, never guessed.
      stats.noVoterId++;
      return;
    }
    const key = precinctKey(rec.county, rec.precinct);
    const bucket = byPrecinct.get(key) ?? [];
    bucket.push({
      voterId: rec.voterId,
      ...(rec.pp !== undefined ? { pp: rec.pp } : {}),
      ...(rec.party ? { party: rec.party } : {}),
      source,
    });
    byPrecinct.set(key, bucket);
  });

  await new Promise<void>((res, rej) => {
    const stream = createReadStream(path, { encoding: "utf8" });
    stream.on("data", (chunk) => parser.write(String(chunk)));
    stream.on("close", res);
    stream.on("end", res);
    stream.on("error", rej);
  });
  parser.end();

  if (headerError) {
    console.error("HEADER PROBLEM — nothing was loaded:");
    for (const p of headerError as string[]) console.error(`  • ${p}`);
    process.exit(1);
  }
  if (!resolved) {
    console.error("No header row found — is the file empty?");
    process.exit(1);
  }

  stats.precincts = byPrecinct.size;

  console.log(`Source: ${source}`);
  console.log(`Rows read:            ${stats.rows.toLocaleString()}`);
  console.log(`Mapped:               ${stats.mapped.toLocaleString()}`);
  console.log(`Skipped (unusable):   ${stats.skippedUnusable.toLocaleString()}`);
  console.log(`No voter ID (name+ZIP only, NOT written): ${stats.noVoterId.toLocaleString()}`);
  console.log(`With primary history: ${stats.withPp.toLocaleString()}`);
  console.log(`With inferred party:  ${stats.withParty.toLocaleString()}`);
  console.log(`Precinct partitions:  ${stats.precincts.toLocaleString()}`);

  if (stats.phonesSeen > 0) {
    console.log(`\nPhone numbers seen:   ${stats.phonesSeen.toLocaleString()} — NOT loaded.`);
    console.log(
      withPhones
        ? "  --with-phones is set, but the phone-append writer is a separate, license-gated step:\n" +
            "  confirm the vendor license permits political phone contact for this committee, then load via\n" +
            "  Dashboard → Voter database → Phone append import. Broadcast texting stays consent-gated (TCPA)."
        : "  Vendor phones are manual-dial / P2P ONLY and never enter the SMS pipeline\n" +
            "  (candidate/voter-file-plan.md §2.3). Loading them also requires written license terms.",
    );
  }

  // Truncation check — the reason to insist on the original CSV.
  if (stats.rows >= 1_048_576 * 0.99) {
    console.warn(
      `\nTRUNCATION WARNING: ${stats.rows.toLocaleString()} rows is at or near Excel's 1,048,576-row cap.\n` +
        "  If this file was re-saved through Excel, rows past the cap were silently dropped.\n" +
        "  Re-export from the original source before trusting this universe.",
    );
  }

  if (dryRun) {
    console.log(`\nDRY RUN — would write ${stats.mapped - stats.noVoterId} overlay rows across ${stats.precincts} precincts.`);
    return;
  }

  let written = 0;
  for (const [key, rows] of byPrecinct) written += await putOverlayRows(key, rows);
  console.log(`\nWROTE ${written.toLocaleString()} overlay rows across ${stats.precincts} precinct partitions.`);

  // Sanity signal: how many of these precincts the spine actually knows about.
  // A large miss means the vendor's precinct naming doesn't line up with the
  // official file's and the join will underperform — worth seeing immediately.
  try {
    const aggs = await queryAllPages({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: { ":p": PK.voterAgg },
    });
    const known = new Set(aggs.map((a) => String(a.SK ?? "")));
    const missing = [...byPrecinct.keys()].filter((k) => !known.has(k));
    if (known.size === 0) {
      // Distinguish "spine is empty" from "names disagree". Both surface as a
      // 100% miss, but the fix is completely different, and reporting an empty
      // spine as a naming problem sends the operator hunting a crosswalk bug
      // that isn't there. The catch below only fires on a query ERROR — an
      // empty result is a successful query returning nothing.
      console.warn(
        "\nThe spine has NO precinct rollups (VOTERAGG is empty) — the official voter file has not been\n" +
          "  ingested into this table. The overlay rows above are written and safe, but nothing can join to\n" +
          "  them yet: enrichment reads overlay rows by the SPINE's precinct keys, so `pp` tags would come\n" +
          "  back 0 and the composer's pp: filters would show no reach.\n" +
          "  Load the official file first (npm run ingest:voters), then re-run the enrichment.",
      );
    } else if (missing.length) {
      console.warn(
        `\n${missing.length} of ${stats.precincts} overlay precincts don't match a spine precinct — ` +
          "the vendor's precinct naming may differ. Sample: " +
          missing.slice(0, 5).join(", "),
      );
    }
  } catch {
    /* spine not loaded yet — nothing to reconcile against */
  }

  console.log("\nNext: re-run the enrichment so the new tags reach the composer —");
  console.log("  npm run enrich:sms -- --dry-run   (then without --dry-run)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
