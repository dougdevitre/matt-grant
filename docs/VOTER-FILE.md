# MO-02 Voter File — where it lives and how to handle it

The five `MO02_VotersList_Part*_of_5.xlsx` files (577,366 registered voters, 2025-map CD-2)
were removed from the repository working tree on 2026-07-10 — **voter PII does not belong in
git**, even in a private repo. Canonical storage is the campaign's private S3 bucket:

```
s3://$S3_ASSETS_BUCKET/voters/raw/MO02_VotersList_Part{1..5}_of_5.xlsx
```

Upload (from a machine with the files + AWS credentials):

```bash
for i in 1 2 3 4 5; do
  aws s3 cp "MO02_VotersList_Part${i}_of_5.xlsx" \
    "s3://$S3_ASSETS_BUCKET/voters/raw/" --sse AES256
done
```

Never place these under the `public/` CDN prefix. The files remain in git HISTORY until an
owner decides on a history purge (coordinated force-push) — see
`candidate/voter-file-plan.md` §2 for the full custody, use-restriction (RSMo 115.157),
and TCPA rules that govern every use of this data.

## Ingest: `web/scripts/ingest-voters.ts`

For the full first-run walkthrough (dry-run → live → reconcile, then the Twilio-fund report),
follow [`RUNBOOK-voter-ingest-and-twilio-fund.md`](./RUNBOOK-voter-ingest-and-twilio-fund.md). Flags:

| Flag | Effect |
|---|---|
| `--dry-run` | Parse + score + print the reconciliation report; write nothing. |
| `--from-s3 [prefix]` | Fetch the xlsx from `s3://$S3_ASSETS_BUCKET/voters/raw/` (default prefix) before ingesting — no manual download. |
| `--reconcile` | Report departed voters (in a prior load, absent now); reported only, never auto-deleted. |
| `--force` | Reload even if the same files (by SHA-256) were already ingested (default is a no-op). |
| `--skip-header-check` | Ingest despite a header/column mismatch — dangerous; only after manually confirming the columns. |
| `--limit N` | Cap rows per file (smoke tests). |

Every run **validates each file's header** against the expected 36 columns and refuses on drift
(index-based parsing would otherwise silently mis-read every row). `--reconcile` is **stock-path only**
— it holds two ~577k voter-ID sets in memory, so run it on a normal machine, not a constrained shell
(the low-mem `loadvoters.cjs` path below does not support it).

## Phase-5 note (2026-07-11)

The ingest now ALSO writes a slim voter-ID index (for the ballot-returns import)
and chase-tier counts on each precinct rollup. Same commands as above - nothing
changes operationally, but if you ingested with an older script, re-run the live
ingest so the chase board and returns matching light up.

## Low-memory / low-throughput path (AWS CloudShell)

The stock `web/scripts/ingest-voters.ts` reads all five workbooks in one process and
writes as fast as it can — which OOM-kills a ~1 GB shell (e.g. AWS CloudShell) and can
throttle a cold DynamoDB table. For those environments use the pre-bundled, self-contained
loader `web/scripts/loadvoters.cjs` — it runs with plain `node` (no `npm install`; xlsx +
the AWS SDK are inlined), processes **one file per invocation** (memory released between
files), writes with **bounded concurrency + throttle-backoff retry**, and merges the
per-precinct rollups in a final pass. It is idempotent — safe to re-run any file, then
finalize.

```bash
# clone (no build needed — the .cjs is committed) and pull the data from S3
git clone https://github.com/dougdevitre/matt-grant.git
aws s3 sync "s3://$S3_ASSETS_BUCKET/voters/raw/" /tmp/voters/
export DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1
for f in /tmp/voters/MO02_VotersList_Part*_of_5.xlsx; do
  node matt-grant/web/scripts/loadvoters.cjs --file "$f"
done
node matt-grant/web/scripts/loadvoters.cjs --finalize
```

`loadvoters.cjs` is generated from `web/scripts/ingest-voters-lowmem.ts`; rebuild it (from `web/`)
with **`npm run bundle:loadvoters`** (wraps the documented `esbuild` command) and commit the
result. Like the stock ingest, the low-mem path validates the header and refuses on column drift
(`--skip-header-check` overrides). If writes still throttle persistently, switch the table to
on-demand (PAY_PER_REQUEST) billing in the AWS console and re-run — the loader is idempotent.

