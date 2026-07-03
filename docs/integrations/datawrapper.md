# Datawrapper chart pipeline (demographics)

We author the demographic charts in **Datawrapper** and commit **static SVG exports**
to `web/public/charts/`, served same-origin. No iframe, no external runtime, no CSP
exception — the site stays self-contained. The committed JSON in `web/lib/demographics/`
is the data source; Datawrapper only renders it.

> **Why static export, not embeds:** the campaign site has a strict self-contained
> posture. A live Datawrapper iframe would add an external dependency + a CSP hole and
> tie the site to datawrapper.de. Static SVG gives the same polish with none of that.

## One-time: load the API in AWS CloudShell

CloudShell (Amazon Linux 2023) has `python3`/`pip3`. Egress from *this* repo's build
container is locked, so the API calls run in **your** CloudShell.

```bash
pip3 install --user datawrapper                 # Datawrapper API client
export DATAWRAPPER_ACCESS_TOKEN="dw-xxxxxxxx"    # datawrapper.de → Settings → API Tokens
                                                 # scopes: chart:read, chart:write
# smoke test (version-proof, no client needed):
curl -s -H "Authorization: Bearer $DATAWRAPPER_ACCESS_TOKEN" https://api.datawrapper.de/v3/me | head
```

The Python client auto-reads `DATAWRAPPER_ACCESS_TOKEN`.

## Build / refresh the charts

```bash
# from a checkout of this repo, in CloudShell:
cd web && npm run demographics          # regenerate lib/demographics/*.json from the CSVs
python3 ../scripts/datawrapper/build_charts.py --export web/public/charts
git add web/lib/demographics web/public/charts && git commit -m "chore(charts): refresh demographic exports"
```

`build_charts.py` reads the committed JSON, creates/updates one Datawrapper chart per
figure (see `CHART_IDS` in `web/lib/demographics/charts.ts`), applies the campaign
theme, sets the title + source note, and exports `web/public/charts/<id>.svg` (+ `.png`).
After the SVGs are committed, flip each chart's `hasExport` to `true` in
`web/lib/demographics/charts.ts` so `<Figure>` shows the SVG (the data table stays as
the accessible fallback).

## Campaign theme (brand tokens)

Match the site so exports don't look foreign. Tokens from `web/tailwind.config.ts`:

| Role | Hex |
|---|---|
| Primary / ink | `#0F2540` |
| Series / field | `#16365C` |
| Accent ("gold" = blue) | `#2563EB` |
| Negative / brick | `#B5343B` |
| Paper | `#FBFAF6` |

Diverging charts (e.g. county under-15 change) use **brick `#B5343B` for decline ↔
blue `#2563EB` for growth**, neutral gray at zero. Every chart's source note must read:
**"U.S. Census Bureau 2025 Vintage · analysis J.S. Sándoval, SLU"** and name the exact
cohort (under-15 vs under-5).

## Chart list & recommended settings

`build_charts.py` sends the data + a starting config (type, source note, highlight,
diverging color-by-`Direction`). Datawrapper honors most of it via the API; confirm
these in the UI (the exact `visualize` key names differ by chart type, so a couple of
settings may need one click). Rows are **pre-sorted** in the CSV, so keep
Datawrapper's "sort bars" **off** (it preserves data order).

| id | Datawrapper type | Data columns | Settings to confirm in the UI |
|---|---|---|---|
| `mo02-child-under15` | Bar chart | County · % change · **Direction** | Color **by column → Direction**: `Decline` = `#B5343B`, `Growth` = `#2563EB`. Value labels on. |
| `under5-metro-ranking` | Bar chart | Metro · % decline | **Highlight** the "St. Louis, MO-IL" bar (`#B5343B`); others muted. Keep the given order (worst first). |
| `stcharles-age-structure` | Grouped bars (split) | Age band · 2020 · 2025 | 2020 = muted, 2025 = `#16365C`. Reverse age order if you want oldest on top. |
| `aging-index-metro` | Bar chart | Metro · aging index 2025 | **Highlight** "St. Louis, MO-IL". |
| `msa-age-series` | Bar chart | Age band · net change · **Direction** | Color **by column → Direction** (same red/blue as above). Natural age order shows youngest→oldest. |

Diverging charts carry a `Direction` category column (`Decline`/`Growth`) exactly so
you can color-by-column in one step. Every chart's **source note** must read
**"U.S. Census Bureau 2025 Vintage · analysis J.S. Sándoval, SLU"** and name the exact
cohort (under-15 vs under-5) — the script sets it, but verify after publish.

Until a chart's SVG is committed, `<Figure>` renders the validated data as an
accessible table with the takeaway sentence — the page is correct and shippable now.
