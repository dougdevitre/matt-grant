/**
 * Memory-safe + throttle-safe MO-02 voter ingest for constrained shells (AWS
 * CloudShell). The stock scripts/ingest-voters.ts reads all five xlsx in one
 * process (SheetJS peak × 2 files OOM-kills a ~1 GB shell) AND queues writes
 * unbounded (throttles the table + piles promises in memory). This variant:
 *   - processes ONE FILE PER PROCESS (memory released between files);
 *   - writes with BOUNDED CONCURRENCY + BACKPRESSURE (flat memory, steady rate);
 *   - RETRIES throttling with exponential backoff (lets an on-demand table scale).
 *
 *   node ingest-lowmem.cjs --file /tmp/voters/MO02_VotersList_Part1_of_5.xlsx
 *   ... (repeat Part2..Part5) ...
 *   node ingest-lowmem.cjs --finalize
 *
 * Per --file: VOTER rows + VOTERIDX rows + per-precinct partial aggs (PK
 *   VAGGPART) + a manifest marker. Idempotent (keys overwrite).
 * Per --finalize: merge every VAGGPART partial into the real VOTERAGG rollups
 *   the dashboard reads + write the ingest manifest. Idempotent.
 *
 * RSMo 115.157: political/election use only. Aggregates never leave the store.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import * as XLSX from "xlsx";
import { parseVoterRow } from "../lib/voters/parse";
import { scoreVoter } from "../lib/voters/score";
import { precinctKey } from "../lib/voters/crosswalk";
import { newAgg, accumulate, type VoterAgg } from "../lib/voters/aggregate";
import { PK, ddb, TABLE, voterIdxShard, queryAllPages } from "../lib/db";
import { BatchWriteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const VAGGPART = "VAGGPART"; // staging partition: precinct partials + manifest markers
const MAX_INFLIGHT = 6; // concurrent BatchWrite requests (well under the 50-socket cap)

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const file = opt("--file");
const finalize = args.includes("--finalize");

if (!TABLE) {
  console.error("DYNAMODB_TABLE is not set. Re-run with: DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 node ...");
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isThrottle = (e: unknown): boolean => {
  const name = (e as { name?: string })?.name ?? "";
  return /Throttling|ProvisionedThroughputExceeded|RequestLimitExceeded|ServiceUnavailable|InternalServerError/i.test(name);
};

/** Write up to 25 items, retrying BOTH UnprocessedItems and thrown throttling
 *  errors with exponential backoff + jitter — the on-demand table scales up
 *  instead of the process dying. */
async function writeBatch(items: Record<string, unknown>[]): Promise<void> {
  let requests = items.map((Item) => ({ PutRequest: { Item } }));
  let attempt = 0;
  while (requests.length) {
    try {
      const res = await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE]: requests } }));
      const un = (res.UnprocessedItems?.[TABLE] ?? []) as typeof requests;
      if (!un.length) return;
      requests = un;
    } catch (e) {
      if (!isThrottle(e) || attempt >= 14) throw e;
    }
    attempt++;
    await sleep(Math.min(10_000, 150 * 2 ** attempt) + Math.floor(Math.random() * 250));
  }
}

/** Bounded-concurrency write pool: submit() applies backpressure so at most
 *  MAX_INFLIGHT batches are in flight — flat memory AND a table-friendly rate. */
function makePool() {
  const inflight = new Set<Promise<void>>();
  return {
    async submit(items: Record<string, unknown>[]) {
      const p = writeBatch(items).finally(() => inflight.delete(p));
      inflight.add(p);
      if (inflight.size >= MAX_INFLIGHT) await Promise.race(inflight);
    },
    async drain() {
      await Promise.all(inflight);
    },
  };
}

function mergeAgg(into: VoterAgg, from: VoterAgg): void {
  into.count += from.count;
  into.active += from.active;
  into.newReg += from.newReg;
  for (let i = 0; i < 6; i++) into.t[i] += from.t[i] ?? 0;
  for (const [k, v] of Object.entries(from.seg)) into.seg[k] = (into.seg[k] ?? 0) + v;
  for (const [k, v] of Object.entries(from.age)) into.age[k] = (into.age[k] ?? 0) + v;
  for (const k of ["1", "2", "3", "4"] as const) into.tiers[k] += from.tiers[k] ?? 0;
  if (!into.county) into.county = from.county;
}

async function ingestOneFile(path: string): Promise<void> {
  const raw = readFileSync(path);
  const sha256 = createHash("sha256").update(raw).digest("hex");
  const wb = XLSX.read(raw, { type: "buffer", cellDates: true, dense: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });

  const aggs = new Map<string, VoterAgg>();
  const pool = makePool();
  let batch: Record<string, unknown>[] = [];
  const push = async (item: Record<string, unknown>) => {
    batch.push(item);
    if (batch.length >= 25) {
      const chunk = batch;
      batch = [];
      await pool.submit(chunk); // backpressure: awaits when the pool is full
    }
  };

  let fileRows = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;
    const parsed = parseVoterRow(r);
    if (!parsed) continue;
    const v = scoreVoter(parsed);
    fileRows++;
    const pk = precinctKey(v.county, v.precinctName);
    const a = aggs.get(pk) ?? newAgg(v.county);
    accumulate(a, v);
    aggs.set(pk, a);
    await push({ PK: PK.voterIdx(voterIdxShard(v.voterId)), SK: v.voterId, precinctKey: pk, segment: v.segment, t: v.t });
    await push({
      PK: PK.voterShard(pk), SK: v.voterId,
      firstName: v.firstName, lastName: v.lastName,
      ...(v.middleName ? { middleName: v.middleName } : {}),
      ...(v.suffix ? { suffix: v.suffix } : {}),
      address: v.address, ...(v.unit ? { unit: v.unit } : {}),
      city: v.city, zip: v.zip,
      ...(v.mailingAddress ? { mailingAddress: v.mailingAddress } : {}),
      county: v.county, precinct: v.precinct, precinctName: v.precinctName,
      ...(v.split ? { split: v.split } : {}),
      ...(v.township ? { township: v.township } : {}),
      ...(v.ward ? { ward: v.ward } : {}),
      yob: v.yob, ...(v.party ? { party: v.party } : {}),
      regDate: v.regDate, active: v.active, lastVoted: v.lastVoted,
      t: v.t, s: v.s, segment: v.segment, newRegistrant: v.newRegistrant,
    });
    if (fileRows % 20000 === 0) console.log(`  …${fileRows} rows`);
  }
  if (batch.length) await pool.submit(batch);
  await pool.drain();

  // Per-precinct partials for this file (tiny — ~213 rows), keyed so re-running
  // the same file overwrites its own partials (idempotent).
  const fname = basename(path);
  const partials = [...aggs.entries()].map(([pk, a]) => ({ PK: VAGGPART, SK: `p#${fname}#${pk}`, pk, ...a }));
  for (let i = 0; i < partials.length; i += 25) await writeBatch(partials.slice(i, i + 25));
  await writeBatch([{ PK: VAGGPART, SK: `m#${fname}`, file: fname, sha256, rows: fileRows }]);
  console.log(`wrote ${fileRows} voters from ${fname} (${aggs.size} precincts, sha256 ${sha256.slice(0, 12)}…)`);
}

async function finalizeAll(): Promise<void> {
  const items = await queryAllPages({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": VAGGPART },
  });
  const merged = new Map<string, VoterAgg>();
  const manifestFiles: { file: string; sha256: string; rows: number }[] = [];
  for (const it of items) {
    const sk = String(it.SK);
    if (sk.startsWith("m#")) {
      manifestFiles.push({ file: String(it.file), sha256: String(it.sha256), rows: Number(it.rows) || 0 });
      continue;
    }
    const pk = String(it.pk);
    const from: VoterAgg = {
      count: Number(it.count) || 0, active: Number(it.active) || 0, newReg: Number(it.newReg) || 0,
      t: (it.t as number[]) ?? [0, 0, 0, 0, 0, 0],
      seg: (it.seg as Record<string, number>) ?? {},
      age: (it.age as Record<string, number>) ?? {},
      tiers: (it.tiers as VoterAgg["tiers"]) ?? { "1": 0, "2": 0, "3": 0, "4": 0 },
      county: String(it.county || ""),
    };
    const into = merged.get(pk) ?? newAgg(from.county);
    mergeAgg(into, from);
    merged.set(pk, into);
  }

  const now = new Date().toISOString();
  const aggItems = [...merged.entries()].map(([pk, a]) => ({ PK: PK.voterAgg, SK: pk, ...a, updatedAt: now }));
  for (let i = 0; i < aggItems.length; i += 25) await writeBatch(aggItems.slice(i, i + 25));

  let total = 0;
  const byCounty: Record<string, number> = {};
  for (const a of merged.values()) {
    total += a.count;
    byCounty[a.county] = (byCounty[a.county] ?? 0) + a.count;
  }
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: PK.ingestRuns("voters"), SK: now,
      files: manifestFiles, voters: total, precincts: merged.size, byCounty,
      note: "loaded via memory-safe per-file ingest (CloudShell)",
    },
  }));

  console.log("\n=== MO-02 VOTER FILE — FINALIZED ===");
  console.log(`voters: ${total}   precincts: ${merged.size}   files: ${manifestFiles.length}`);
  console.log("By county:");
  for (const [c, n] of Object.entries(byCounty).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(14)} ${String(n).padStart(7)}  ${((100 * n) / Math.max(1, total)).toFixed(1)}%`);
  }
  console.log(`\nWROTE ${aggItems.length} precinct rollups + 1 manifest. Dashboard is live.`);
}

async function main() {
  if (finalize) return finalizeAll();
  if (file) return ingestOneFile(file);
  console.error("usage: node ingest-lowmem.cjs --file <one xlsx>   |   --finalize");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
