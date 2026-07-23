# Digital custom-audience export — reach voters you can't text

The MO-02 voter file (~500k) has no phone numbers, so it can **never** be texted (TCPA). But the
campaign can reach those voters with **digital ads** by uploading a hashed *Custom Audience* to
Meta. This is the off-SMS complement to call sheets, canvassing, ballot chase, and direct mail.

`scripts/export-digital-audience.ts` produces a **SHA-256-hashed Meta Custom Audience CSV** for a
chosen voter segment across the district. The file contains **only hashed match keys** — no
plaintext names, addresses, or voter IDs — so raw voter data never leaves the campaign.

## Compliance — read first

- **RSMo 115.157:** Missouri voter data is for **political/election purposes only**. Using it for
  the campaign's OWN political ad targeting is a political purpose. It must never be used
  commercially, published, or resold.
- **No consent needed (unlike SMS).** Digital ads to a Custom Audience do not require the
  individual's opt-in the way texting does — but you MUST be an **authorized political advertiser**
  on the platform and follow its Custom Audience / Customer Match terms.
- **Privacy by construction:** the export is pre-hashed (SHA-256 of normalized name + city + state
  + zip + country). Only hashes leave the campaign; the platform matches hash-to-hash.
- *This is educational information, not legal advice. Consult counsel before uploading.*

## Generate the file

From `web/`, with production AWS credentials + the voter file ingested:

```
DYNAMODB_TABLE=matt-grant npx tsx scripts/export-digital-audience.ts \
  --segment MOBILIZE,BANK \
  --out audience.csv \
  [--exclude-banked] \
  [--state MO] [--country US]
```

- `--segment` — comma-separated voter segments (`MOBILIZE`, `BANK`, `PERSUADE`, `PROSPECT`).
  Default: all except `MONITOR` (opposition/inactive get no spend). Prioritize the same way SMS
  does: MOBILIZE (GOTV core) and BANK first, then PERSUADE.
- `--exclude-banked` — drop voters who have already returned a ballot (GOTV mode; reads the
  imported county ballot returns). Use during the chase window so you don't pay to reach people
  who've voted.
- `--out` — output path (default `digital-audience.csv`).

The script iterates one precinct shard at a time (bounded memory, like the enrichment job) and
prints **counts only** — never a name, address, or hash sample — plus the compliance reminder.

## Upload to Meta

1. Meta Ads Manager → **Audiences** → **Create audience** → **Custom Audience** → **Customer list**.
2. Upload `audience.csv`. When asked, indicate the data is **already hashed**.
3. Map the columns: `fn`, `ln`, `ct` (city), `st` (state), `zip`, `country`.
4. Build ads / a lookalike against the resulting audience once it populates.

Match rates on name + address alone are modest (no email/phone in the file), but it's the only
digital path for voters the campaign can't text — and it scales to the full segment.

## What this is not

- **Not texting.** This never feeds the SMS pipeline; the voter-file isolation guard
  (`lib/sms/audiences.voterfile-isolation.test.ts`) still holds.
- **Google Customer Match** is a future variant — it uses different hashing rules (name hashed,
  zip/country left plaintext), so it needs its own column mapping. Not built yet.
