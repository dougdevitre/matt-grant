# Geodata + 3D Map + Missouri Trends — Data Plan

How to power the campaign's interactive 3D field map (`/dashboard/map`) with real 2026 data, and
which Missouri datasets reveal the trends worth chasing. Everything here is public, free, and
loadable as GeoJSON. Sample data ships in `web/lib/mapData.ts`; this is how to make it live.

> Educational planning doc. Verify every dataset's vintage and licensing before public use. Map
> figures shipped in the app (turnout, partner points) are illustrative placeholders.

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
`tactics/ballot-chase-program.md`. Paid for by the Matt Grant for Congress Committee._
