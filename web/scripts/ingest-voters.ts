/**
 * MO-02 voter-file ingest (candidate/voter-file-plan.md §3) — run with tsx:
 *
 *   npx tsx scripts/ingest-voters.ts --dir /path/to/xlsx --dry-run
 *   npx tsx scripts/ingest-voters.ts --dir /path/to/xlsx            # writes DynamoDB
 *   npx tsx scripts/ingest-voters.ts --from-s3                      # fetch xlsx from S3 first
 *   ... [--limit N]              cap rows per file (smoke tests)
 *   ... [--force]                reload even if the same files were already ingested
 *   ... [--skip-header-check]    ingest despite a header/column mismatch (dangerous)
 *   ... [--reconcile]            report departed voters (in a prior load, absent now)
 *
 * Reads the five MO02_VotersList_Part*_of_5.xlsx exports — from a local --dir, or
 * fetched from the private S3 voters/raw/ prefix with --from-s3 (see
 * docs/VOTER-FILE.md) — VALIDATES each file's header against the expected column
 * order (index-based parsing fails loudly on drift), and is IDEMPOTENT: a re-run
 * of the same file set is a no-op unless --force. Parses + scores every voter
 * (lib/voters/*), and:
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
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import * as XLSX from "xlsx";
import { parseVoterRow, validateHeader, COLUMNS } from "../lib/voters/parse";
import { scoreVoter, type ScoredVoter } from "../lib/voters/score";
import { precinctKey } from "../lib/voters/crosswalk";
import { accumulate, newAgg, type VoterAgg } from "../lib/voters/aggregate";
import { planResume, reconcileCounts, reconcileStale, type PriorRun } from "../lib/voters/ingestPlan";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const dirArg = opt("--dir");
const dryRun = flag("--dry-run");
const force = flag("--force");
const skipHeaderCheck = flag("--skip-header-check");
const fromS3 = flag("--from-s3");
const reconcile = flag("--reconcile");
const s3Prefix = opt("--from-s3") && !opt("--from-s3")!.startsWith("--") ? opt("--from-s3")! : "voters/raw/";
const limit = Number(opt("--limit") ?? 0) || Infinity;
if (!dirArg && !fromS3) {
  console.error(
    "usage: npx tsx scripts/ingest-voters.ts (--dir <xlsx dir> | --from-s3 [prefix]) " +
      "[--dry-run] [--force] [--skip-header-check] [--reconcile] [--limit N]",
  );
  process.exit(1);
}

/**
 * Download the voter xlsx from the private S3 bucket to a temp dir, so the
 * operator doesn't have to fetch them by hand (voter-file-plan.md §2 custody
 * rules still apply — the temp copy is local-only and short-lived).
 */
async function fetchFromS3(prefix: string): Promise<string> {
  const bucket = process.env.S3_ASSETS_BUCKET;
  if (!bucket) {
    console.error("Set S3_ASSETS_BUCKET to use --from-s3.");
    process.exit(1);
  }
  const { S3Client, ListObjectsV2Command, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  const keys = (listed.Contents ?? []).map((o) => o.Key).filter((k): k is string => !!k && /\.xlsx$/i.test(k));
  if (!keys.length) {
    console.error(`No .xlsx objects under s3://${bucket}/${prefix}`);
    process.exit(1);
  }
  const dest = mkdtempSync(join(tmpdir(), "mo02-voters-"));
  for (const key of keys) {
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!obj.Body) continue;
    const bytes = await obj.Body.transformToByteArray();
    writeFileSync(join(dest, basename(key)), Buffer.from(bytes));
    console.log(`fetched s3://${bucket}/${key}`);
  }
  return dest;
}

async function main() {
  const dir = fromS3 ? await fetchFromS3(s3Prefix) : dirArg!;
  const files = readdirSync(dir)
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
  let priorRuns: PriorRun[] = [];
  // --reconcile only: the voter IDs seen in THIS run, and the IDs stored BEFORE it.
  const currentIds = new Set<string>();
  let prevIds: Set<string> | null = null;

  // Live-write plumbing loaded lazily so dry-run needs no AWS config at all.
  let write: ((v: ScoredVoter, pk: string) => void) | null = null;
  let flush: (() => Promise<void>) | null = null;
  if (!dryRun) {
    const { batchWritePut } = await import("../lib/integrations/batchWrite");
    const { PK, voterIdxShard, ddb, TABLE, queryAllPages } = await import("../lib/db");
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");

    // Resume/idempotency guard: if a prior run already ingested these exact files
    // (by content hash), re-running is a no-op — the identical rows are present
    // and re-parsing 577k voters would just rewrite them. Skip unless --force.
    // (Per-file resume can't help here: aggregates are recomputed from ALL files
    // in one pass and overwrite VOTERAGG wholesale, so a partial read would write
    // partial rollups. Resume is therefore a whole-run decision.)
    const fileRefs = files.map((f) => ({
      file: f,
      sha256: createHash("sha256").update(readFileSync(join(dir, f))).digest("hex"),
    }));
    const prior = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": PK.ingestRuns("voters") },
      }),
    );
    priorRuns = (prior.Items ?? []) as PriorRun[];
    const decision = planResume(priorRuns, fileRefs, force);
    if (decision.skip) {
      console.log(
        `Already ingested (run ${decision.coveredBy?.SK}) — all ${files.length} file hashes match. ` +
          "Nothing to do; pass --force to reload.",
      );
      return;
    }

    // --reconcile: snapshot the PRIOR stored voter-ID set BEFORE this run upserts
    // rows (ingest never deletes, so departed voters would still be present after
    // the write). Enumerate the ~178 precinct keys from VOTERAGG, then drain each
    // VOTER# partition projecting only the sort key (voterId) — bounded per
    // partition, no Scan, never one 577k Query (db.ts:66; contracts "never Scan").
    if (reconcile) {
      const aggRows = await queryAllPages({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": PK.voterAgg },
      });
      prevIds = new Set<string>();
      for (const a of aggRows) {
        if (typeof a.SK !== "string") continue;
        const rows = await queryAllPages({
          TableName: TABLE,
          KeyConditionExpression: "PK = :p",
          ExpressionAttributeValues: { ":p": PK.voterShard(a.SK) },
          ProjectionExpression: "SK",
        });
        for (const r of rows) if (typeof r.SK === "string") prevIds.add(r.SK);
      }
      console.log(`--reconcile: snapshotted ${prevIds.size} prior voter IDs across ${aggRows.length} precincts.`);
    }

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
    const raw = readFileSync(join(dir, f));
    const sha256 = createHash("sha256").update(raw).digest("hex");
    const wb = XLSX.read(raw, { type: "buffer", cellDates: true, dense: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });

    // Schema gate: parsing is index-based, so a reordered/renamed column would
    // silently mis-read every row. Fail loudly on drift unless explicitly waived.
    const headerProblems = validateHeader(rows[0] ?? []);
    if (headerProblems.length) {
      console.error(`\nHEADER MISMATCH in ${f} — index-based parsing would mis-read every row:`);
      for (const p of headerProblems.slice(0, 12)) console.error(`  - ${p}`);
      if (headerProblems.length > 12) console.error(`  … and ${headerProblems.length - 12} more`);
      if (!skipHeaderCheck) {
        console.error("Refusing to ingest. Re-verify the export columns, or pass --skip-header-check to override.");
        process.exit(1);
      }
      console.error("Continuing despite mismatch (--skip-header-check).");
    }

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
      if (reconcile) currentIds.add(v.voterId);
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

  // Cheap drift signal vs the last load's manifest count (no table scan). A full
  // departed-voter reconciliation (reconcileStale) can run separately when needed.
  const rec = reconcileCounts(priorRuns, total);
  if (rec.previous != null && rec.delta != null) {
    console.log(`Vs last load: ${rec.previous} → ${total} (${rec.delta >= 0 ? "+" : ""}${rec.delta} net registrants)`);
  }

  // --reconcile (live only): exact departed-voter set — IDs stored before this
  // run but absent from it. Reported, never auto-deleted (voter-file-plan.md §2.5).
  let departedCount = 0;
  if (reconcile && prevIds) {
    const departed = reconcileStale(prevIds, currentIds);
    departedCount = departed.length;
    console.log(
      `Departed (in prior load, absent now): ${departedCount}` +
        (departedCount ? ` — sample: ${departed.slice(0, 10).join(", ")}` : "") +
        " (reported only, never auto-deleted)",
    );
  }

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
        headerOk: true, // every file passed validateHeader (or --skip-header-check was used)
        reconciliation: { previous: rec.previous, delta: rec.delta, departed: reconcile ? departedCount : null },
      },
    }),
  );
  console.log(`\nWROTE ${total} voter rows (+ ${total} id-index rows), ${aggItems.length} precinct aggregates, 1 manifest.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
