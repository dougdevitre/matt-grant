/**
 * MO-02 voter-file ingest (candidate/voter-file-plan.md §3) — run with tsx:
 *
 *   npx tsx scripts/ingest-voters.ts --dir /path/to/xlsx --dry-run
 *   npx tsx scripts/ingest-voters.ts --dir /path/to/xlsx            # writes DynamoDB
 *   ... [--limit N]  cap rows per file (smoke tests)
 *
 * Reads the five MO02_VotersList_Part*_of_5.xlsx exports (from the private S3
 * voters/raw/ prefix — download locally first; see docs/VOTER-FILE.md), parses
 * + scores every voter (lib/voters/*), and:
 *   - DRY-RUN: prints the reconciliation report ONLY (counts, per-county census,
 *     T/segment histograms, party fill, district coding) — no writes, no PII out.
 *   - LIVE: batch-writes sharded voter rows (PK VOTER#county#precinct, SK voter
 *     id), VOTERAGG per-precinct rollups, and an ingest-manifest row
 *     (PK INGESTRUN#voters) with file hashes + the same report.
 *
 * RSMo 115.157: this data is for political/election purposes only. Handle per
 * the custody rules in candidate/voter-file-plan.md §2.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { parseVoterRow, COLUMNS } from "../lib/voters/parse";
import { scoreVoter, type ScoredVoter } from "../lib/voters/score";
import { precinctKey } from "../lib/voters/crosswalk";
import { accumulate, newAgg, type VoterAgg } from "../lib/voters/aggregate";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const dir = opt("--dir");
const dryRun = flag("--dry-run");
const limit = Number(opt("--limit") ?? 0) || Infinity;
if (!dir) {
  console.error("usage: npx tsx scripts/ingest-voters.ts --dir <xlsx dir> [--dry-run] [--limit N]");
  process.exit(1);
}

async function main() {
  const files = readdirSync(dir!)
    .filter((f) => /\.xlsx$/i.test(f))
    .sort();
  if (!files.length) {
    console.error(`no .xlsx files in ${dir}`);
    process.exit(1);
  }

  const aggs = new Map<string, VoterAgg>();
  const county = new Map<string, number>();
  const cd = new Map<string, number>();
  const manifestFiles: { file: string; sha256: string; rows: number }[] = [];
  let total = 0;
  let skipped = 0;
  let partyFilled = 0;
  const districtTotals = newAgg("(district)");

  // Live-write plumbing loaded lazily so dry-run needs no AWS config at all.
  let write: ((v: ScoredVoter, pk: string) => void) | null = null;
  let flush: (() => Promise<void>) | null = null;
  if (!dryRun) {
    const { batchWritePut } = await import("../lib/integrations/batchWrite");
    const { PK, voterIdxShard } = await import("../lib/db");
    const buf: Record<string, unknown>[] = [];
    const CONCURRENCY = 8;
    const pending: Promise<void>[] = [];
    const drain = async () => {
      const items = buf.splice(0, buf.length);
      if (items.length) await batchWritePut(items);
    };
    write = (v, pk) => {
      // Slim ID→precinct index (Phase 5): lets the ballot-returns import find a
      // voter's shard/segment from the county file's voter id alone. Sharded by
      // the id's tail so the 577k index writes spread across ~100 partitions.
      buf.push({
        PK: PK.voterIdx(voterIdxShard(v.voterId)),
        SK: v.voterId,
        precinctKey: pk,
        segment: v.segment,
        t: v.t,
      });
      buf.push({
        PK: PK.voterShard(pk),
        SK: v.voterId,
        firstName: v.firstName,
        lastName: v.lastName,
        ...(v.middleName ? { middleName: v.middleName } : {}),
        ...(v.suffix ? { suffix: v.suffix } : {}),
        address: v.address,
        ...(v.unit ? { unit: v.unit } : {}),
        city: v.city,
        zip: v.zip,
        ...(v.mailingAddress ? { mailingAddress: v.mailingAddress } : {}),
        county: v.county,
        precinct: v.precinct,
        precinctName: v.precinctName,
        ...(v.split ? { split: v.split } : {}),
        ...(v.township ? { township: v.township } : {}),
        ...(v.ward ? { ward: v.ward } : {}),
        yob: v.yob,
        ...(v.party ? { party: v.party } : {}),
        regDate: v.regDate,
        active: v.active,
        lastVoted: v.lastVoted,
        t: v.t,
        s: v.s,
        segment: v.segment,
        newRegistrant: v.newRegistrant,
      });
      if (buf.length >= 25 * CONCURRENCY) {
        pending.push(drain());
      }
    };
    flush = async () => {
      pending.push(drain());
      await Promise.all(pending);
    };
  }

  for (const f of files) {
    const raw = readFileSync(join(dir!, f));
    const sha256 = createHash("sha256").update(raw).digest("hex");
    const wb = XLSX.read(raw, { type: "buffer", cellDates: true, dense: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });
    let fileRows = 0;
    for (let i = 1; i < rows.length && fileRows < limit; i++) {
      const r = rows[i];
      if (!r || r.length < 2) continue;
      const parsed = parseVoterRow(r);
      if (!parsed) {
        skipped++;
        continue;
      }
      const v = scoreVoter(parsed);
      fileRows++;
      total++;
      county.set(v.county, (county.get(v.county) ?? 0) + 1);
      cd.set(v.cd2025 || "(blank)", (cd.get(v.cd2025 || "(blank)") ?? 0) + 1);
      if (v.party) partyFilled++;
      const pk = precinctKey(v.county, v.precinctName);
      const a = aggs.get(pk) ?? newAgg(v.county);
      accumulate(a, v);
      accumulate(districtTotals, v);
      aggs.set(pk, a);
      write?.(v, pk);
    }
    manifestFiles.push({ file: f, sha256, rows: fileRows });
    console.log(`read ${f}: ${fileRows} voters (sha256 ${sha256.slice(0, 12)}…)`);
  }

  // ---- Reconciliation report (aggregates only — never a voter row) ----
  const pct = (n: number) => `${((100 * n) / Math.max(1, total)).toFixed(1)}%`;
  console.log("\n=== MO-02 VOTER FILE RECONCILIATION ===");
  console.log(`voters: ${total}  (skipped unparseable: ${skipped})  precincts: ${aggs.size}`);
  console.log(`columns expected: ${COLUMNS.length}`);
  console.log("\nBy county:");
  for (const [c, n] of [...county.entries()].sort((x, y) => y[1] - x[1])) console.log(`  ${c.padEnd(14)} ${String(n).padStart(7)}  ${pct(n)}`);
  console.log("\n2025-map district coding:");
  for (const [c, n] of [...cd.entries()].sort((x, y) => y[1] - x[1])) console.log(`  ${c.padEnd(14)} ${String(n).padStart(7)}  ${pct(n)}`);
  console.log(`\nActive: ${districtTotals.active} (${pct(districtTotals.active)})  party filled: ${partyFilled} (${pct(partyFilled)})  new registrants: ${districtTotals.newReg} (${pct(districtTotals.newReg)})`);
  console.log("T histogram (0-5):", districtTotals.t.join(" / "));
  console.log("Segments:", Object.entries(districtTotals.seg).map(([k, v]) => `${k}=${v} (${pct(v)})`).join("  "));
  console.log("Age bands:", Object.entries(districtTotals.age).sort().map(([k, v]) => `${k}=${v}`).join("  "));

  if (dryRun) {
    console.log("\nDRY RUN — nothing written.");
    return;
  }

  // ---- Live: flush voters, then aggregates + manifest ----
  const { batchWritePut } = await import("../lib/integrations/batchWrite");
  const { PK, ddb, TABLE } = await import("../lib/db");
  const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
  await flush!();
  const aggItems = [...aggs.entries()].map(([pk, a]) => ({
    PK: PK.voterAgg,
    SK: pk,
    ...a,
    updatedAt: new Date().toISOString(),
  }));
  await batchWritePut(aggItems);
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: PK.ingestRuns("voters"),
        SK: new Date().toISOString(),
        files: manifestFiles,
        voters: total,
        skipped,
        precincts: aggs.size,
        byCounty: Object.fromEntries(county),
        byCd: Object.fromEntries(cd),
        t: districtTotals.t,
        segments: districtTotals.seg,
      },
    }),
  );
  console.log(`\nWROTE ${total} voter rows (+ ${total} id-index rows), ${aggItems.length} precinct aggregates, 1 manifest.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
