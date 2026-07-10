"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/mapData";

// Free, no-API-key vector basemap (same tiles as RegionMap3D). 2D only — no
// pitch/bearing/extrusions — since this just needs to plot sign locations.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// Tier colors match the ranked-table badges (SignPlacementTool tierColor): brick (A),
// campaign-accent blue (B), slate (C) — distinct hues so priority reads at a glance.
const TIER_COLOR: Record<"A" | "B" | "C", string> = { A: "#B5343B", B: "#2563EB", C: "#5A6472" };

export type SignMapProps = {
  placements: GeoJSON.FeatureCollection; // deployable, scored — properties: name/type/tier/score/captainId/precinct
  dropped: GeoJSON.FeatureCollection; // hard-filtered out — properties: name/reasons
};

export default function SignsMap({ placements, dropped }: SignMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const placementsRef = useRef(placements);
  placementsRef.current = placements;
  const droppedRef = useRef(dropped);
  droppedRef.current = dropped;

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
      // Dropped locations first (underneath) — muted, so deployable pins read on top.
      m.addSource("dropped", { type: "geojson", data: droppedRef.current });
      m.addLayer({
        id: "dropped-circles",
        source: "dropped",
        type: "circle",
        paint: {
          "circle-radius": 5,
          "circle-color": "#B5343B",
          "circle-opacity": 0.25,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#B5343B",
          "circle-stroke-opacity": 0.6,
        },
      });

      m.addSource("placements", { type: "geojson", data: placementsRef.current });
      m.addLayer({
        id: "placement-circles",
        source: "placements",
        type: "circle",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 10],
          "circle-color": ["match", ["get", "tier"], "A", TIER_COLOR.A, "B", TIER_COLOR.B, "C", TIER_COLOR.C, TIER_COLOR.C],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      const popup = new maplibregl.Popup({ closeButton: false, offset: 12 });

      m.on("mouseenter", "placement-circles", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "placement-circles", () => {
        m.getCanvas().style.cursor = "";
        popup.remove();
      });
      m.on("click", "placement-circles", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name: string; type: string; tier: "A" | "B" | "C"; score: number; captainId?: string; precinct?: string };
        const lines = [
          `<strong>${p.name}</strong>`,
          `<span style="color:${TIER_COLOR[p.tier]}">Tier ${p.tier}</span> · ${p.type} · score ${Number(p.score).toFixed(2)}`,
          p.captainId ? `Captain: ${p.captainId}` : "",
          p.precinct ? `Precinct: ${p.precinct}` : "",
        ].filter(Boolean);
        popup
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(lines.join("<br/>"))
          .addTo(m);
      });

      m.on("mouseenter", "dropped-circles", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "dropped-circles", () => {
        m.getCanvas().style.cursor = "";
        popup.remove();
      });
      m.on("click", "dropped-circles", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name: string; reasons: string };
        popup
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(`<strong>${p.name}</strong><br/><span style="color:#B5343B">DROPPED: ${p.reasons}</span>`)
          .addTo(m);
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
    const all = [...placementsRef.current.features, ...droppedRef.current.features];
    if (all.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const f of all) {
      if (f.geometry.type === "Point") bounds.extend(f.geometry.coordinates as [number, number]);
    }
    if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
  }

  // Push new data in as the pasted CSV changes.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("placements") as maplibregl.GeoJSONSource | undefined)?.setData(placements);
    fitToData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("dropped") as maplibregl.GeoJSONSource | undefined)?.setData(dropped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropped]);

  return <div ref={container} className="h-full w-full" />;
}
