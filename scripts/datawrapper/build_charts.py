#!/usr/bin/env python3
"""Author the demographic charts in Datawrapper from the committed JSON and export
static SVG (+ PNG) into web/public/charts/. Runs in AWS CloudShell (this repo's
build container has locked egress). See docs/integrations/datawrapper.md.

    export DATAWRAPPER_ACCESS_TOKEN="dw-..."
    python3 scripts/datawrapper/build_charts.py --export web/public/charts

Uses the stable Datawrapper v3 REST API (version-proof) via `requests`. Chart IDs
are persisted in scripts/datawrapper/chart-ids.json so re-runs UPDATE the same
charts instead of creating duplicates. After exports are committed, set each
chart's `hasExport = true` in web/lib/demographics/charts.ts.
"""
import argparse
import json
import os
import sys
from pathlib import Path

import requests  # pip3 install --user requests

API = "https://api.datawrapper.de/v3"
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "web" / "lib" / "demographics"
IDS_FILE = Path(__file__).resolve().parent / "chart-ids.json"

SOURCE_NAME = "U.S. Census Bureau 2025 Vintage · analysis J.S. Sándoval, SLU"
SOURCE_URL = "https://www.census.gov/programs-surveys/popest.html"

# Campaign brand tokens (web/tailwind.config.ts)
INK, FIELD, ACCENT, BRICK, PAPER = "#0F2540", "#16365C", "#2563EB", "#B5343B", "#FBFAF6"

MO02 = ["St. Louis County", "St. Charles County", "Jefferson County",
        "Franklin County", "Warren County", "Lincoln County"]


def load(name):
    return json.loads((DATA / name).read_text())["items"]


def csv(headers, rows):
    out = [",".join(headers)]
    for r in rows:
        out.append(",".join('"%s"' % c if ("," in str(c)) else str(c) for c in r))
    return "\n".join(out)


def specs():
    """id -> {title, type, csv, metadata} — one per figure in charts.ts."""
    county = {r["county"]: r for r in load("childUnder15ByCounty.json")}
    mo02 = [county[c] for c in MO02 if c in county]
    under5 = sorted(load("under5DeclineByMetro.json"), key=lambda r: float(r["pctDecline"]))[:12]
    stc = [r for r in load("stCharlesAgeStructure.json") if r["ageGroup"] != "Total"]
    aging = sorted(load("agingIndexByMetro.json"), key=lambda r: -float(r["agingIndex2025"]))[:12]
    msa = [r for r in load("msaPopulationByAge.json") if r["ageGroup"] != "Total"]

    return {
        "mo02-child-under15": {
            "title": "Children under 15 are declining across MO-02",
            "type": "d3-bars",
            "csv": csv(["County", "% change 2020-2025"],
                      [[r["county"].replace(" County", ""), r["pctChange"]] for r in mo02]),
            "visualize": {"custom-colors": {}, "color-by-column": True,
                          "background": False, "thick": True},
        },
        "under5-metro-ranking": {
            "title": "St. Louis: 3rd-worst U.S. metro for the decline in children under 5",
            "type": "d3-bars",
            "csv": csv(["Metro", "% decline (under 5)"],
                      [[r["metro"], r["pctDecline"]] for r in under5]),
            "visualize": {"highlighted-values": ["St. Louis, MO-IL"]},
        },
        "stcharles-age-structure": {
            "title": "St. Charles County: seniors now outnumber children",
            "type": "d3-bars-split",
            "csv": csv(["Age group", "2020", "2025"],
                      [[r["ageGroup"].replace("Age ", ""), r["pop2020"], r["pop2025"]] for r in stc]),
            "visualize": {},
        },
        "aging-index-metro": {
            "title": "St. Louis ranks among the oldest large U.S. metros",
            "type": "d3-bars",
            "csv": csv(["Metro", "Aging index 2025"],
                      [[r["metro"], r["agingIndex2025"]] for r in aging]),
            "visualize": {"highlighted-values": ["St. Louis, MO-IL"]},
        },
        "msa-age-series": {
            "title": "St. Louis MSA: fewer children, more seniors (2020-2025)",
            "type": "d3-bars-split",
            "csv": csv(["Age group", "2020", "2025"],
                      [[r["ageGroup"].replace("Age ", ""), r["y2020"], r["y2025"]] for r in msa]),
            "visualize": {},
        },
    }


class DW:
    def __init__(self, token):
        self.s = requests.Session()
        self.s.headers["Authorization"] = f"Bearer {token}"

    def _j(self, r):
        r.raise_for_status()
        return r.json() if r.content else {}

    def create(self, title, ctype):
        return self._j(self.s.post(f"{API}/charts", json={"title": title, "type": ctype}))["id"]

    def set_data(self, cid, data):
        r = self.s.put(f"{API}/charts/{cid}/data", data=data.encode(),
                       headers={"Content-Type": "text/csv"})
        r.raise_for_status()

    def patch(self, cid, spec):
        meta = {
            "title": spec["title"],
            "type": spec["type"],
            "metadata": {
                "describe": {"source-name": SOURCE_NAME, "source-url": SOURCE_URL},
                "visualize": {"thick": True, "base-color": FIELD,
                              "custom-colors": {}, **spec.get("visualize", {})},
                "publish": {"blocks": {"logo": False, "get-the-data": True, "embed": False}},
            },
        }
        self._j(self.s.patch(f"{API}/charts/{cid}", json=meta))

    def publish(self, cid):
        self._j(self.s.post(f"{API}/charts/{cid}/publish"))

    def export(self, cid, fmt, path):
        r = self.s.get(f"{API}/charts/{cid}/export/{fmt}",
                       params={"unit": "px", "mode": "rgb", "plain": "false",
                               "width": 720, "borderWidth": 0},
                       headers={"Accept": f"image/{fmt}" if fmt == "png" else "image/svg+xml"})
        r.raise_for_status()
        Path(path).write_bytes(r.content)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--export", default="web/public/charts", help="output dir for SVG/PNG")
    args = ap.parse_args()

    token = os.environ.get("DATAWRAPPER_ACCESS_TOKEN")
    if not token:
        sys.exit("DATAWRAPPER_ACCESS_TOKEN not set (see docs/integrations/datawrapper.md)")

    outdir = ROOT / args.export
    outdir.mkdir(parents=True, exist_ok=True)
    ids = json.loads(IDS_FILE.read_text()) if IDS_FILE.exists() else {}
    dw = DW(token)

    for cid, spec in specs().items():
        chart_id = ids.get(cid) or dw.create(spec["title"], spec["type"])
        ids[cid] = chart_id
        dw.set_data(chart_id, spec["csv"])
        dw.patch(chart_id, spec)
        dw.publish(chart_id)
        for fmt in ("svg", "png"):
            dw.export(chart_id, fmt, outdir / f"{cid}.{fmt}")
        print(f"✓ {cid} → {chart_id} (svg+png)")

    IDS_FILE.write_text(json.dumps(ids, indent=2) + "\n")
    print(f"\nExported {len(ids)} charts → {outdir}")
    print("Next: set hasExport=true for these ids in web/lib/demographics/charts.ts, commit the SVGs.")


if __name__ == "__main__":
    main()
