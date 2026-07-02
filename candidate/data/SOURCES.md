# Demographic data — sources & definitions

These five CSVs are the source of truth for the demographic figures shown in the
app (data hub, "MO-02 by the numbers" page, Children First page). The build script
`web/scripts/generate-demographics.ts` (`npm run demographics`) parses them into
validated JSON manifests under `web/lib/demographics/`.

## Citation (use verbatim on every figure)

**U.S. Census Bureau, 2025 Vintage population estimates (age/sex/race/ethnicity).
Analysis by Prof. J.S. "Ness" Sándoval, Saint Louis University.**

## Files & exact definitions

| File | What it measures | Geography | Period |
|---|---|---|---|
| `children-under-15-by-county-2020-2025.csv` | Children **under age 15** (count) | St. Louis MSA counties (MO + IL) + MSA total | 2020 vs 2025 |
| `children-under-5-decline-by-metro.csv` | Children **under age 5** — absolute + % decline | 50 largest U.S. metros | 2020–2025 |
| `st-charles-age-structure-2020-2025.csv` | Population by 5-year age band | **St. Charles County, MO** | 2020 vs 2025 |
| `aging-index-by-metro-2020-2025.csv` | Aging index + % age 65+ | 50 largest U.S. metros | 2020 vs 2025 |
| `msa-population-by-age-2020-2025.csv` | Population by 5-year age band | **St. Louis MSA** | 2020–2025 (annual) |

**Cohort matters:** the county file is **under 15**, the metro-ranking file is
**under 5** — never relabel one as the other. (Cross-checked: MSA under-15 =
515,347 (2020) → 481,589 (2025); St. Charles total Δ = +21,233; Jefferson under-15
Δ = −2,396 — all match the published analysis.)

## Known data issue (unresolved)

`children-under-15-by-county-2020-2025.csv` lists **"Madison County" twice**:
- `46922 → 43865` — this is **Madison County, Illinois** (part of the 15-county MSA).
- `6574 → 5951` — an **unlabeled second "Madison County"** row. This does not match
  Madison County, MO (not in the MSA) and is likely a mislabel (possibly Monroe
  County, IL, which is otherwise absent). **Left as-is, pending confirmation from
  the source author.** Do **not** publish this row as a labeled figure until
  resolved; the MO-02 charts (see `MO02_COUNTY_NAMES` in `web/lib/demographics/
  schema.ts`) exclude it. A vitest tripwire (`demographics.test.ts`) fails if the
  duplicate is silently changed.

## Geography note

The **St. Louis MSA** (metro) is not the **MO-02 congressional district**. MO-02 is
a subset of these counties. Label figures precisely; lead with MO-02 counties, use
the metro and national numbers as context.

## Regenerating

Edit the CSV(s), then `cd web && npm run demographics`. Commit the CSV + the
regenerated `web/lib/demographics/*.json` together.
