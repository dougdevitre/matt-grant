"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CATEGORIES, MAP_CENTER, MAP_ZOOM, PRECINCTS, type Category } from "@/lib/mapData";

// Free, no-API-key vector basemap (OpenStreetMap-based). Swap the style for
// OpenFreeMap "liberty"/"bright" or a MapTiler key if you want a different look.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

type Props = {
  visible: Category[];
  buildings: boolean;
  turnout: boolean;
  pois: GeoJSON.FeatureCollection;
};

export default function RegionMap3D({ visible, buildings, turnout, pois }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const poisRef = useRef(pois);
  poisRef.current = pois;

  // Init once.
  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      pitch: 50,
      bearing: -17,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    m.on("load", () => {
      // 3D buildings from the basemap's vector source (if present).
      try {
        if (m.getSource("openmaptiles")) {
          m.addLayer({
            id: "3d-buildings",
            source: "openmaptiles",
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 12,
            paint: {
              "fill-extrusion-color": "#cbd2dc",
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.8,
            },
          });
        }
      } catch {
        /* basemap schema differs — skip buildings */
      }

      // Precinct turnout columns (blended boundary + results data → 3D height).
      m.addSource("precincts", { type: "geojson", data: PRECINCTS });
      m.addLayer({
        id: "precinct-extrude",
        source: "precincts",
        type: "fill-extrusion",
        paint: {
          "fill-extrusion-color": [
            "interpolate", ["linear"], ["get", "lean"],
            0.45, "#E0A53B", 0.6, "#cf7a39", 0.7, "#B5343B",
          ],
          "fill-extrusion-height": ["*", ["get", "turnout"], 80],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.55,
        },
      });

      // POIs (live from /api/geo when available, else sample).
      m.addSource("pois", { type: "geojson", data: poisRef.current });
      m.addLayer({
        id: "poi-circles",
        source: "pois",
        type: "circle",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4, 13, 8],
          "circle-color": [
            "match", ["get", "category"],
            "schools", CATEGORIES.schools.color,
            "partners", CATEGORIES.partners.color,
            "public", CATEGORIES.public.color,
            "polling", CATEGORIES.polling.color,
            "#888888",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      const popup = new maplibregl.Popup({ closeButton: false, offset: 12 });
      m.on("mouseenter", "poi-circles", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "poi-circles", () => {
        m.getCanvas().style.cursor = "";
        popup.remove();
      });
      m.on("click", "poi-circles", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name: string; category: Category; note?: string };
        popup
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<strong>${p.name}</strong><br/><span style="color:${CATEGORIES[p.category].color}">${CATEGORIES[p.category].label}</span>${p.note ? ` · ${p.note}` : ""}`,
          )
          .addTo(m);
      });
      m.on("click", "precinct-extrude", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const pr = f.properties as { name: string; turnout: number };
        new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${pr.name}</strong><br/>Turnout (illustrative): ${pr.turnout}%`)
          .addTo(m);
      });

      ready.current = true;
      // Apply initial prop-driven visibility.
      syncVisibility();
    });

    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncVisibility() {
    const m = map.current;
    if (!m || !ready.current) return;
    if (m.getLayer("poi-circles")) {
      m.setFilter("poi-circles", ["in", ["get", "category"], ["literal", visible]]);
    }
    if (m.getLayer("3d-buildings")) {
      m.setLayoutProperty("3d-buildings", "visibility", buildings ? "visible" : "none");
    }
    if (m.getLayer("precinct-extrude")) {
      m.setLayoutProperty("precinct-extrude", "visibility", turnout ? "visible" : "none");
    }
  }

  // Re-apply when toggles change.
  useEffect(syncVisibility, [visible, buildings, turnout]);

  // Push new POI data (e.g. live polling places) into the map when it arrives.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    const src = m.getSource("pois") as maplibregl.GeoJSONSource | undefined;
    src?.setData(pois);
  }, [pois]);

  return <div ref={container} className="h-full w-full" />;
}
