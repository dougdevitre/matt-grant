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
and TCPA rules that govern every use of this data. Ingest: `web/scripts/ingest-voters.ts`.

## Phase-5 note (2026-07-11)

The ingest now ALSO writes a slim voter-ID index (for the ballot-returns import)
and chase-tier counts on each precinct rollup. Same commands as above - nothing
changes operationally, but if you ingested with an older script, re-run the live
ingest so the chase board and returns matching light up.
