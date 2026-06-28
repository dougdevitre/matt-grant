# Geodata + 3D Map + Missouri Trends — Data Plan

How to power the campaign's interactive 3D field map (`/dashboard/map`) with real 2026 data, and
which Missouri datasets reveal the trends worth chasing. Everything here is public, free, and
loadable as GeoJSON. Sample data ships in `web/lib/mapData.ts`; this is how to make it live.

> Educational planning doc. Verify every dataset's vintage and licensing before public use. Map
> figures shipped in the app (turnout, partner points) are illustrative placeholders.

## 0. District coverage — MO-02 ≠ St. Louis County (important)

St. Louis County is split across **MO-01, MO-02, and MO-03**, and MO-02 reaches **beyond the
county**. So St. Louis County GIS only covers the **St. Louis County portion** of the district:

- **Precinct turnout + target list** — already filtered to MO-02 (`congressional_district_20`), but
  only the St. Louis County precincts (41 county municipalities).
- **Polling places** — the county layer has no district field, so the app now **spatially clips** it
  to the MO-02 precinct polygons (point-in-polygon). Sites in MO-01/MO-03 are excluded.
- **Missing** — the rest of MO-02 in other counties.

**The map in effect is now settled (verified June 2026).** Missouri's 2025 mid-decade map was signed
2025-09-28 and upheld by the MO Supreme Court 2026-03-24 (4-3); local election officials are using it
for the Aug 4 2026 primary. A citizen ballot initiative could still suspend it.

| Era | MO-02 counties beyond St. Louis Co. | Notes |
|---|---|---|
| **OLD 2022 map** (used 2024) | St. Charles Co. (+ part of Warren) | What our St. Louis Co. 2024 precinct tags reflect (western county) |
| **NEW 2025 map** (Aug 4 2026) | **Jefferson, Washington, Crawford, Gasconade** | St. Charles & Warren moved to MO-03; **Franklin is NOT in MO-02** |

Two consequences for this app:

1. **St. Louis County footprint (done, verified).** The county's official precinct layer
   (`April_7_2026_Precincts_Dashboard_view`) carries two congressional fields — `congressio`
   (alias **congress22**, old) and `congress_1` (alias **congress25**, new). The app now scopes
   membership on **congress25** and joins **Aug 2024 primary turnout** by precinct code (506 of 630
   precincts matched; 80%). Cross-referenced to municipalities, the new MO-02 St. Louis slice stays
   **predominantly western/central** (Chesterfield, Wildwood, Ballwin, Maryland Heights, Kirkwood,
   Town & Country) — 564 precincts unchanged, 66 added (e.g. more Maryland Heights / Creve Coeur),
   48 dropped (e.g. Webster Groves / Shrewsbury / Maplewood). It did **not** shift to the southern
   suburbs; the district's southward move is the added rural counties below.
> **County-level turnout (verified June 2026):** the SOS *Official Election Returns* PDF for the
> Aug 6 2024 primary is **statewide office totals only** — it carries no county turnout/registration
> (checked all 48 pages; the four rural counties are not in it). County turnout lives in the SOS
> **Election Night Reporting** per-county views, which are not a clean machine-readable dataset, so
> rural-county turnout is **not wired** — the counties show boundaries only, not shaded by turnout.
> Source: <https://www.sos.mo.gov/CMSImages/ElectionResultsStatistics/2024PrimaryElection.pdf>.

2. **Rural counties** — add one geo-proxy per county (pattern in `lib/geoSources.ts`). Jefferson has
   ArcGIS precinct polygons; Washington/Crawford/Gasconade have no ArcGIS feed → use Census VTD
   boundaries + SOS county-level turnout/registration. None publish precinct-level turnout, so
   whole-district turnout columns are not feasible from live feeds — only St. Louis County does.

Sources: [2025 Missouri redistricting](https://en.wikipedia.org/wiki/2025_Missouri_redistricting) ·
[Inside Elections analysis](https://www.insideelections.com/news/article/a-detailed-analysis-of-missouris-new-congressional-map) ·
[STLPR — officials using new map (Jun 2026)](https://www.stlpr.org/government-politics-issues/2026-06-16/local-election-officials-missouri-gerrymandered-congressional-map).

---

## 1. Best geodata sources (the map's base layers)

| Layer | Best source | Format | How to load |
|---|---|---|---|
| **District boundary (MO-02)** | Census TIGER/Line congressional districts; new 2026 boundaries collected early 2026 | Shapefile / GeoJSON | Census FTP, or convert with `mapshaper`/`ogr2ogr` to GeoJSON |
| **Precincts** | St. Louis County Election Board GIS (the portal you screenshotted) | CSV / Shapefile / **GeoJSON** / KML | ArcGIS Hub "…/datasets/<id>.geojson" |
| **Polling places** | Same county GIS — "April 7, 2026 … Polling Places" (196 records) | GeoJSON / CSV | Download or hit the FeatureServer `?f=geojson` |
| **Schools** | MSDIS "MO Public Schools" + school-district boundaries; NCES EDGE for national coverage | GeoJSON / Shapefile | MSDIS Open Data / NCES EDGE geocodes |
| **Public places** (libraries, parks, places of worship, community/rec centers, markets) | **OpenStreetMap via Overpass API** | GeoJSON | Overpass query by `amenity`/`leisure` tags within the district bbox |
| **County base** (parcels, municipal boundaries, roads) | St. Louis County GIS Service Center | GeoJSON / Shapefile | ArcGIS Hub download |
| **Statewide layers** (county/city boundaries, hydrography) | MSDIS (Missouri's clearinghouse) | Shapefile / GeoJSON | MSDIS vector data / Open Data |

**Verified portals:**
- St. Louis County Election Board GIS (precincts, polling, district sheets): <https://gis-data-stlouiscovotes.hub.arcgis.com/>
- St. Louis County GIS Service Center (base/parcels): <https://data2-stlcogis.opendata.arcgis.com/> and <https://gis.stlouiscountymo.gov/>
- MSDIS (statewide clearinghouse): <https://msdis.missouri.edu/> · Open Data: <https://data-msdis.opendata.arcgis.com/>
- Census TIGER/Line: <https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html>
- OpenStreetMap Overpass: <https://overpass-turbo.eu/> (export GeoJSON)
- NCES EDGE (schools): <https://nces.ed.gov/programs/edge/>

**Already wired (live in the app):** the official polling-places layer streams into `/dashboard/map`
via the proxy `app/api/geo/pois` from
`https://services6.arcgis.com/wkbq75VVf2MvUvs7/arcgis/rest/services/4_7_2026_Polling_Places/FeatureServer/0/query?...&f=geojson`
(196 records, fields: name, address, zipcode). It falls back to sample points if the county feed is
unreachable. Add more layers in `web/lib/geoSources.ts`.

**ArcGIS → GeoJSON in one line:** any ArcGIS Hub dataset serves GeoJSON at
`https://<hub-host>/datasets/<dataset-id>.geojson`, or query a FeatureServer directly:
`https://services.arcgis.com/.../FeatureServer/0/query?where=1=1&outFields=*&f=geojson`.
Drop the file in `web/public/data/` and point `lib/mapData.ts` at it (or fetch the URL at runtime).

**Overpass query (public places in the district bbox):**
```
[out:json];
( node["amenity"~"library|community_centre|place_of_worship|school"]({{bbox}});
  way["leisure"~"park|recreation_ground"]({{bbox}}); );
out center;
```

---

## 2. "How else can we blend 2026 data into the 3D map?" — integration menu

The map already fuses **boundaries + turnout** into 3D columns and extrudes **3D buildings**. Each
additional 2026 source below snaps onto the same MapLibre scene; the right ones for this campaign
are marked ★.

| 2026 data source | What it adds | 3D technique |
|---|---|---|
| ★ **County precinct results + SOS turnout** (2024 general, 2022/2024 primaries) | Real column heights & shading by precinct | `fill-extrusion-height` by turnout, color by margin |
| ★ **Census ACS 2024 5-yr** (households w/ children B11005, age, income) | Children-first targeting; affordability map | Choropleth or extruded block groups; bivariate color |
| ★ **OSM foot-traffic anchors** (markets, parks, rec, worship) | "Where voters spend time" canvass plan | Clustered points + heatmap of density |
| **Voter file / early-vote & absentee feed** (county) | Live chase: who's voted | Time-slider animating returns by precinct |
| **Terrain / elevation (AWS Terrarium / Mapzen DEM, free)** | True 3D landscape under the data | MapLibre `terrain` + hillshade |
| **Redistricting "new map" (2025 MO map, if in effect)** | Correct geography incl. added rural counties | Swap boundary source; verify legal status first |
| **Transit & drive-time isochrones (OSM + OSRM/Valhalla)** | Event siting, ride-to-polls | Isochrone polygons, extruded by minutes |
| **Parcels + place POIs (county GIS)** | Door universe, sign locations | Building extrusion already supports this |
| **Mobility/POI dwell (SafeGraph-style, commercial)** | High-dwell public venues | Hexbin aggregation (deck.gl `HexagonLayer`) |

**To go beyond MapLibre's built-in extrusions** for heavier blends (hexbin aggregation, arcs,
animated trips), add **deck.gl** interleaved with the MapLibre context — same camera, GPU-batched.
Recommended next layers: `HexagonLayer` (foot-traffic density), `ColumnLayer` (precinct turnout as
true columns), `TripsLayer` (canvass routes over time), `GeoJsonLayer` with `extruded: true`
(ACS block groups by % households with children). Add a **time-slider** to animate early-vote
returns precinct-by-precinct in the final two weeks.

**Reduced-friction basemap/terrain options (no API key):** OpenFreeMap vector tiles (current
default), CARTO basemaps, AWS terrain tiles. MapTiler/Mapbox give richer terrain + a generous free
tier if you add a key.

---

## 3. Missouri data for seeing the trends

| Trend question | Dataset | Where |
|---|---|---|
| Where is primary turnout high/low, and rising? | SOS previous-election results + turnout (precinct/county) | <https://www.sos.mo.gov/elections/resultsandstats/previouselections> |
| How many registered voters, and the trend? | SOS Registered Voters reports | <https://www.sos.mo.gov/elections/registeredvoters> |
| Live county-level results on election nights | SOS Election Night Reporting | <https://www.sos.mo.gov/elections/> |
| Who's in the field (filings)? | SOS candidate list | <https://www.sos.mo.gov/elections/candidates> |
| Demographic shifts (age, income, **households with children**) | Census ACS (data.census.gov / API) | <https://data.census.gov/> |
| Partisan baseline / lean | Cook PVI + precinct results join | Cook Political Report; county results |
| Money trend (receipts, COH, where opponents raise) | FEC bulk data / candidate pages | <https://www.fec.gov/data/> |

**The three trends that matter most for Aug 4:**
1. **Primary turnout by precinct** (small, intense electorate) → where the win number actually lives.
2. **Households with children by block group** (ACS) → aligns the children-first message with geography.
3. **Early/absentee pace** in the final 14 days → drives the chase program.

Join precinct results (SOS/county) to precinct polygons (county GIS) on precinct ID, push the
result into the map's `precincts` source, and the 3D columns become real instead of illustrative.

---

## 4. Wiring it into this app

1. Export the layer as GeoJSON (county GIS GeoJSON button, Overpass export, or `ogr2ogr`/`mapshaper`).
2. Save to `web/public/data/<layer>.geojson`.
3. In `web/lib/mapData.ts`, replace the sample `POIS`/`PRECINCTS` with a fetch of that file (or
   pass the URL to `RegionMap3D`).
4. For demographics, fetch the ACS API server-side, attach values to block-group polygons, and add
   a second `fill-extrusion`/choropleth layer.

_Frameworks from `workflows/voter-targeting.md`, `tactics/voter-personas.md`, and
`tactics/ballot-chase-program.md`. Paid for by Matt Grant for Congress._
