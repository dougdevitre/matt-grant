"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/mapData";
import { STATUS } from "@/lib/viz/palette";
import { bboxOfFeatureCollections, DISTRICT_FALLBACK_BOUNDS } from "@/lib/viz/mapView";

// The maplibre canvas for the coverage map — loaded with ssr:false from
// CoverageMap (maplibre needs the browser). Same 2D single-purpose pattern as
// SignsMap: one geojson source, fill+line layers, popup, setData on prop change.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// gap → bad (brick), covered → good (field), overlap → warn (gold) — the same
// STATUS trio the dashboards use, so flags read identically on list and map.
// (Duplicated in CoverageMap's legend — importing from here would defeat ssr:false.)
const COVERAGE_COLOR = { gap: STATUS.bad, covered: STATUS.good, overlap: STATUS.warn } as const;

export default function CoverageMapCanvas({ features }: { features: GeoJSON.Feature[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const fc = useMemo<GeoJSON.FeatureCollection>(() => ({ type: "FeatureCollection", features }), [features]);
  const fcRef = useRef(fc);
  fcRef.current = fc;

  // Init once.
  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), "top-right");

    m.on("load", () => {
      m.addSource("coverage", { type: "geojson", data: fcRef.current });
      m.addLayer({
        id: "coverage-fill",
        source: "coverage",
        type: "fill",
        paint: {
          "fill-color": [
            "match",
            ["get", "coverage"],
            "gap",
            COVERAGE_COLOR.gap,
            "covered",
            COVERAGE_COLOR.covered,
            "overlap",
            COVERAGE_COLOR.overlap,
            COVERAGE_COLOR.gap,
          ],
          "fill-opacity": ["match", ["get", "coverage"], "covered", 0.25, 0.35],
        },
      });
      m.addLayer({
        id: "coverage-line",
        source: "coverage",
        type: "line",
        paint: { "line-color": "#ffffff", "line-width": 0.8, "line-opacity": 0.7 },
      });

      const popup = new maplibregl.Popup({ closeButton: false, offset: 10 });
      m.on("mouseenter", "coverage-fill", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "coverage-fill", () => {
        m.getCanvas().style.cursor = "";
        popup.remove();
      });
      m.on("click", "coverage-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as {
          regionName: string;
          level: string;
          coverage: keyof typeof COVERAGE_COLOR;
          captains: string;
          teamSize: number;
          portion?: string;
        };
        const lines = [
          `<strong>${p.regionName}</strong>${p.portion ? ` <em>(${p.portion})</em>` : ""}`,
          `<span style="color:${COVERAGE_COLOR[p.coverage] ?? STATUS.bad}">${String(p.coverage).toUpperCase()}</span> · ${p.level}`,
          `${p.captains} · ${p.teamSize} on team`,
        ];
        popup.setLngLat(e.lngLat).setHTML(lines.join("<br/>")).addTo(m);
      });

      ready.current = true;
      fitToData();
    });

    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fitToData() {
    const m = map.current;
    if (!m || !ready.current) return;
    const b = bboxOfFeatureCollections([fcRef.current]) ?? DISTRICT_FALLBACK_BOUNDS;
    m.fitBounds(b, { padding: 32, maxZoom: 12, duration: 0 });
  }

  // Push new data in when the geometry joins finish loading.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("coverage") as maplibregl.GeoJSONSource | undefined)?.setData(fc);
    fitToData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fc]);

  return <div ref={container} className="h-full w-full" />;
}
