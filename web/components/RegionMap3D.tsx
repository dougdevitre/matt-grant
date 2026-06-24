"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CATEGORIES, EVENT_COLOR, MAP_CENTER, MAP_ZOOM, type Category } from "@/lib/mapData";

const EVENT_TYPE_LABEL: Record<string, string> = {
  rally: "Rally", "town-hall": "Town hall", fundraiser: "Fundraiser", canvass: "Canvass",
  parade: "Parade", "meet-greet": "Meet & greet", debate: "Debate / forum", "volunteer-shift": "Volunteer shift", other: "Event",
};

// Free, no-API-key vector basemap (OpenStreetMap-based). Swap the style for
// OpenFreeMap "liberty"/"bright" or a MapTiler key if you want a different look.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

type Props = {
  visible: Category[];
  buildings: boolean;
  turnout: boolean;
  pois: GeoJSON.FeatureCollection;
  precincts: GeoJSON.FeatureCollection;
  jefferson: GeoJSON.FeatureCollection;
  showJefferson: boolean;
  extraCounties: GeoJSON.FeatureCollection;
  showExtra: boolean;
  events: GeoJSON.FeatureCollection;
  showEvents: boolean;
};

export default function RegionMap3D({ visible, buildings, turnout, pois, precincts, jefferson, showJefferson, extraCounties, showExtra, events, showEvents }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const poisRef = useRef(pois);
  poisRef.current = pois;
  const precinctsRef = useRef(precincts);
  precinctsRef.current = precincts;
  const jeffersonRef = useRef(jefferson);
  jeffersonRef.current = jefferson;
  const extraRef = useRef(extraCounties);
  extraRef.current = extraCounties;
  const eventsRef = useRef(events);
  eventsRef.current = events;

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

      // Precinct turnout columns: real MO-02 Nov-2024 turnout (clamped for the
      // height/color ramp; raw value shown in the popup). Height + heat = turnout.
      // Ramp tuned to PRIMARY turnout (~8–40%) so precinct variation reads clearly.
      const t: maplibregl.ExpressionSpecification = ["coalesce", ["get", "turnout"], 0];
      m.addSource("precincts", { type: "geojson", data: precinctsRef.current });
      m.addLayer({
        id: "precinct-extrude",
        source: "precincts",
        type: "fill-extrusion",
        paint: {
          "fill-extrusion-color": [
            "interpolate", ["linear"], t,
            8, "#d8d5cc", 18, "#E0A53B", 28, "#cf7a39", 40, "#B5343B",
          ],
          "fill-extrusion-height": ["*", t, 130],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.6,
        },
      });

      // Jefferson County — added to MO-02 in the 2025 map. Boundary-only (no
      // turnout feed), so it's a flat fill + outline, visually distinct from the
      // St. Louis turnout columns.
      m.addSource("jefferson", { type: "geojson", data: jeffersonRef.current });
      // Shade by county turnout when present (lib/countyTurnout.ts), else flat.
      const countyTurnoutColor: maplibregl.ExpressionSpecification = [
        "case",
        ["has", "turnoutPct"],
        ["interpolate", ["linear"], ["get", "turnoutPct"], 10, "#d8d5cc", 20, "#E0A53B", 30, "#cf7a39", 40, "#B5343B"],
        "#5b7d6f",
      ];
      const countyTurnoutOpacity: maplibregl.ExpressionSpecification = ["case", ["has", "turnoutPct"], 0.42, 0.18];
      m.addLayer({
        id: "jefferson-fill",
        source: "jefferson",
        type: "fill",
        layout: { visibility: showJefferson ? "visible" : "none" },
        paint: { "fill-color": countyTurnoutColor, "fill-opacity": countyTurnoutOpacity },
      });
      m.addLayer({
        id: "jefferson-line",
        source: "jefferson",
        type: "line",
        layout: { visibility: showJefferson ? "visible" : "none" },
        paint: { "line-color": "#3f5a4f", "line-width": 1, "line-opacity": 0.6 },
      });
      m.on("click", "jefferson-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const pr = f.properties as { Precinct?: string; turnoutPct?: number };
        const note = pr.turnoutPct != null
          ? `County turnout (Aug '24): <strong>${pr.turnoutPct}%</strong>`
          : `<span style="color:#5b7d6f">boundary only — no turnout feed</span>`;
        new maplibregl.Popup({ closeButton: false, offset: 8 })
          .setLngLat(e.lngLat)
          .setHTML(`<strong>Jefferson Co.</strong><br/>${pr.Precinct ?? "Precinct"}<br/>${note}`)
          .addTo(m);
      });

      // Washington / Crawford / Gasconade — Census 2020 VTDs (boundary-only).
      m.addSource("extra", { type: "geojson", data: extraRef.current });
      m.addLayer({
        id: "extra-fill",
        source: "extra",
        type: "fill",
        layout: { visibility: showExtra ? "visible" : "none" },
        paint: {
          "fill-color": ["case", ["has", "turnoutPct"], ["interpolate", ["linear"], ["get", "turnoutPct"], 10, "#d8d5cc", 20, "#E0A53B", 30, "#cf7a39", 40, "#B5343B"], "#7c6f8e"],
          "fill-opacity": ["case", ["has", "turnoutPct"], 0.42, 0.16],
        },
      });
      m.addLayer({
        id: "extra-line",
        source: "extra",
        type: "line",
        layout: { visibility: showExtra ? "visible" : "none" },
        paint: { "line-color": "#5a4f6e", "line-width": 1, "line-opacity": 0.55 },
      });
      m.on("click", "extra-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const pr = f.properties as { county?: string; NAME?: string; turnoutPct?: number };
        const note = pr.turnoutPct != null
          ? `County turnout (Aug '24): <strong>${pr.turnoutPct}%</strong>`
          : `<span style="color:#7c6f8e">Census VTD — no turnout feed</span>`;
        new maplibregl.Popup({ closeButton: false, offset: 8 })
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${pr.county ?? ""} Co.</strong><br/>${pr.NAME ?? ""}<br/>${note}`)
          .addTo(m);
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
      m.on("mouseenter", "precinct-extrude", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "precinct-extrude", () => (m.getCanvas().style.cursor = ""));
      m.on("click", "precinct-extrude", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const pr = f.properties as { name: string; municipality?: string; turnout?: number; registered?: number };
        const lines = [
          `<strong>${pr.name}</strong>`,
          pr.municipality ? pr.municipality : "",
          pr.turnout != null ? `Primary turnout (Aug '24): <strong>${pr.turnout}%</strong>` : "Turnout: n/a",
          pr.registered ? `Registered: ${pr.registered.toLocaleString()}` : "",
          `<a href="/dashboard/targets?precinct=${encodeURIComponent(pr.name ?? "")}" style="display:inline-block;margin-top:6px;color:#B5343B;font-weight:700;text-decoration:none">Target this precinct →</a>`,
        ].filter(Boolean);
        new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setLngLat(e.lngLat)
          .setHTML(lines.join("<br/>"))
          .addTo(m);
      });

      // Events layer — campaign appearances geocoded from their address. Diamond-ish
      // markers in field green, distinct from the POI circles; click → dashboard event.
      m.addSource("events", { type: "geojson", data: eventsRef.current });
      m.addLayer({
        id: "event-circles",
        source: "events",
        type: "circle",
        layout: { visibility: showEvents ? "visible" : "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 6, 13, 11],
          // Draft events read lighter (gold) than published (green).
          "circle-color": ["case", ["==", ["get", "status"], "PUBLISHED"], EVENT_COLOR, "#E0A53B"],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.9,
        },
      });
      m.on("mouseenter", "event-circles", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "event-circles", () => (m.getCanvas().style.cursor = ""));
      m.on("click", "event-circles", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { id: string; title: string; type: string; status: string; start: string; locationName?: string };
        const when = p.start ? new Date(p.start).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
        const lines = [
          `<strong>${p.title}</strong>`,
          `<span style="color:${EVENT_COLOR}">${EVENT_TYPE_LABEL[p.type] ?? "Event"}</span>${p.status !== "PUBLISHED" ? ` · <span style="color:#9a6f1a">${p.status.toLowerCase()}</span>` : ""}`,
          when,
          p.locationName ? p.locationName : "",
          `<a href="/dashboard/events/${encodeURIComponent(p.id)}" style="display:inline-block;margin-top:6px;color:#B5343B;font-weight:700;text-decoration:none">Open event →</a>`,
        ].filter(Boolean);
        new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(lines.join("<br/>"))
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
    (m.getSource("pois") as maplibregl.GeoJSONSource | undefined)?.setData(pois);
  }, [pois]);

  // Push live precinct turnout when it arrives.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("precincts") as maplibregl.GeoJSONSource | undefined)?.setData(precincts);
  }, [precincts]);

  // Jefferson data + visibility.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("jefferson") as maplibregl.GeoJSONSource | undefined)?.setData(jefferson);
  }, [jefferson]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    for (const id of ["jefferson-fill", "jefferson-line"]) {
      if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", showJefferson ? "visible" : "none");
    }
  }, [showJefferson]);

  // Extra counties (VTD) data + visibility.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("extra") as maplibregl.GeoJSONSource | undefined)?.setData(extraCounties);
  }, [extraCounties]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    for (const id of ["extra-fill", "extra-line"]) {
      if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", showExtra ? "visible" : "none");
    }
  }, [showExtra]);

  // Events data + visibility.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("events") as maplibregl.GeoJSONSource | undefined)?.setData(events);
  }, [events]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    if (m.getLayer("event-circles")) m.setLayoutProperty("event-circles", "visibility", showEvents ? "visible" : "none");
  }, [showEvents]);

  return <div ref={container} className="h-full w-full" />;
}
