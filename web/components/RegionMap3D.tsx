"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CATEGORIES, EVENT_COLOR, MAP_CENTER, MAP_ZOOM, type Category } from "@/lib/mapData";
import { BRAND, TURNOUT_RAMP, MAP_FALLBACK, MAP_LINE, MAP_BUILDINGS, POI_FALLBACK, EVENT_DRAFT, GOLD_INK, SIGN_COLOR } from "@/lib/viz/palette";
import { bboxOfFeatureCollections, DISTRICT_FALLBACK_BOUNDS, type Bounds } from "@/lib/viz/mapView";
import { colorExpr, heightExpr, modeStats, type MapMode } from "@/lib/viz/precinctPaint";

const EVENT_TYPE_LABEL: Record<string, string> = {
  rally: "Rally", "town-hall": "Town hall", fundraiser: "Fundraiser", canvass: "Canvass",
  parade: "Parade", "meet-greet": "Meet & greet", debate: "Debate / forum", "volunteer-shift": "Volunteer shift", other: "Event",
};

// Free, no-API-key vector basemap (OpenStreetMap-based). Swap the style for
// OpenFreeMap "liberty"/"bright" or a MapTiler key if you want a different look.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// The home camera angle — shared by init, the auto-fit, and the reset button.
const HOME_PITCH = 50;
const HOME_BEARING = -17;

// Minimal custom map button (maplibre ships no generic button control). Same
// chrome as the built-in controls via the maplibregl-ctrl classes.
function buttonControl(title: string, label: string, onClick: () => void): maplibregl.IControl {
  let el: HTMLDivElement | null = null;
  return {
    onAdd() {
      el = document.createElement("div");
      el.className = "maplibregl-ctrl maplibregl-ctrl-group";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = title;
      btn.setAttribute("aria-label", title);
      btn.textContent = label;
      btn.addEventListener("click", onClick);
      el.appendChild(btn);
      return el;
    },
    onRemove() {
      el?.remove();
      el = null;
    },
  };
}

// A one-shot camera command from the host (deep link / search): fit these bounds
// and pulse the precinct with this featureId. `token` distinguishes commands —
// next/dynamic doesn't forward refs, so an imperative "go here" arrives as a prop.
export type MapFocus = { bounds: Bounds; featureId?: string; token: number };

type Props = {
  visible: Category[];
  buildings: boolean;
  turnout: boolean;
  mode: MapMode;
  pois: GeoJSON.FeatureCollection;
  precincts: GeoJSON.FeatureCollection;
  precinctsLive: boolean;
  jefferson: GeoJSON.FeatureCollection;
  showJefferson: boolean;
  extraCounties: GeoJSON.FeatureCollection;
  showExtra: boolean;
  events: GeoJSON.FeatureCollection;
  showEvents: boolean;
  signs: GeoJSON.FeatureCollection;
  showSigns: boolean;
  focus?: MapFocus | null;
};

export default function RegionMap3D({ visible, buildings, turnout, mode, pois, precincts, precinctsLive, jefferson, showJefferson, extraCounties, showExtra, events, showEvents, signs, showSigns, focus }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const poisRef = useRef(pois);
  poisRef.current = pois;
  const precinctsRef = useRef(precincts);
  precinctsRef.current = precincts;
  const precinctsLiveRef = useRef(precinctsLive);
  precinctsLiveRef.current = precinctsLive;
  const jeffersonRef = useRef(jefferson);
  jeffersonRef.current = jefferson;
  const extraRef = useRef(extraCounties);
  extraRef.current = extraCounties;
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const signsRef = useRef(signs);
  signsRef.current = signs;
  // Auto-fit fires once, when live precincts first arrive — never on later data
  // pushes, so a camera the operator has moved is left alone.
  const didFit = useRef(false);
  const homeBounds = useRef<Bounds>(DISTRICT_FALLBACK_BOUNDS);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Focus commands can land before the style finishes loading — stash and replay.
  const focusRef = useRef<MapFocus | null | undefined>(focus);
  focusRef.current = focus;
  const doneFocusToken = useRef(0);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function applyPrecinctPaint() {
    const m = map.current;
    if (!m || !ready.current || !m.getLayer("precinct-extrude")) return;
    const stats = modeStats(precinctsRef.current.features);
    m.setPaintProperty("precinct-extrude", "fill-extrusion-color", colorExpr(modeRef.current, stats));
    m.setPaintProperty("precinct-extrude", "fill-extrusion-height", heightExpr(modeRef.current, stats));
  }

  function applyFocus() {
    const m = map.current;
    const f = focusRef.current;
    if (!m || !ready.current || !f || f.token === doneFocusToken.current) return;
    doneFocusToken.current = f.token;
    m.fitBounds(f.bounds, { padding: 80, pitch: HOME_PITCH, bearing: HOME_BEARING, duration: 900, maxZoom: 13.5 });
    if (f.featureId) {
      const id = f.featureId;
      m.setFeatureState({ source: "precincts", id }, { hover: true });
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => {
        // Map may have been torn down while the pulse was pending.
        if (map.current?.getSource("precincts")) map.current.setFeatureState({ source: "precincts", id }, { hover: false });
      }, 2500);
    }
  }

  function fitDistrict() {
    const m = map.current;
    if (!m) return;
    const b = bboxOfFeatureCollections([precinctsRef.current, jeffersonRef.current, extraRef.current]);
    if (b) homeBounds.current = b;
    m.fitBounds(homeBounds.current, { padding: 40, pitch: HOME_PITCH, bearing: HOME_BEARING, duration: 800 });
  }

  function maybeFitOnLive() {
    if (didFit.current || !ready.current || !precinctsLiveRef.current) return;
    if ((precinctsRef.current?.features.length ?? 0) === 0) return;
    didFit.current = true;
    fitDistrict();
  }

  // Init once.
  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      pitch: HOME_PITCH,
      bearing: HOME_BEARING,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.addControl(new maplibregl.FullscreenControl(), "top-right");
    m.addControl(buttonControl("Reset view to the district", "⌂", fitDistrict), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-left");

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
              "fill-extrusion-color": MAP_BUILDINGS,
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.8,
            },
          });
        }
      } catch {
        /* basemap schema differs — skip buildings */
      }

      // Precinct columns. Color + height come from lib/viz/precinctPaint per the
      // current mode (turnout %, target tier, or GOTV upside) — the initial paint
      // below and every later mode switch use the same tested expression builders.
      // promoteId lets hover feature-state key off the precinct name (GeoJSON
      // features from the route carry no numeric ids).
      const initialStats = modeStats(precinctsRef.current.features);
      m.addSource("precincts", { type: "geojson", data: precinctsRef.current, promoteId: "name" });
      m.addLayer({
        id: "precinct-extrude",
        source: "precincts",
        type: "fill-extrusion",
        paint: {
          "fill-extrusion-color": colorExpr(modeRef.current, initialStats),
          "fill-extrusion-height": heightExpr(modeRef.current, initialStats),
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.85, 0.6],
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
        ["interpolate", ["linear"], ["get", "turnoutPct"], 10, TURNOUT_RAMP[0], 20, TURNOUT_RAMP[1], 30, TURNOUT_RAMP[2], 40, TURNOUT_RAMP[3]],
        MAP_FALLBACK.jefferson,
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
        paint: { "line-color": MAP_LINE.jefferson, "line-width": 1, "line-opacity": 0.6 },
      });
      m.on("click", "jefferson-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const pr = f.properties as { Precinct?: string; turnoutPct?: number };
        const note = pr.turnoutPct != null
          ? `County turnout (Aug '24): <strong>${pr.turnoutPct}%</strong>`
          : `<span style="color:${MAP_FALLBACK.jefferson}">boundary only — no turnout feed</span>`;
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
          "fill-color": ["case", ["has", "turnoutPct"], ["interpolate", ["linear"], ["get", "turnoutPct"], 10, TURNOUT_RAMP[0], 20, TURNOUT_RAMP[1], 30, TURNOUT_RAMP[2], 40, TURNOUT_RAMP[3]], MAP_FALLBACK.extra],
          "fill-opacity": ["case", ["has", "turnoutPct"], 0.42, 0.16],
        },
      });
      m.addLayer({
        id: "extra-line",
        source: "extra",
        type: "line",
        layout: { visibility: showExtra ? "visible" : "none" },
        paint: { "line-color": MAP_LINE.extra, "line-width": 1, "line-opacity": 0.55 },
      });
      m.on("click", "extra-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const pr = f.properties as { county?: string; NAME?: string; turnoutPct?: number };
        const note = pr.turnoutPct != null
          ? `County turnout (Aug '24): <strong>${pr.turnoutPct}%</strong>`
          : `<span style="color:${MAP_FALLBACK.extra}">Census VTD — no turnout feed</span>`;
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
            POI_FALLBACK,
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
      // Hover: highlight the column (feature-state drives the opacity expression
      // above) + a light name/turnout popup. Touch devices never fire mousemove,
      // so the click popup below stays the mobile path.
      let hoveredPrecinct: string | number | undefined;
      const clearPrecinctHover = () => {
        if (hoveredPrecinct !== undefined) {
          m.setFeatureState({ source: "precincts", id: hoveredPrecinct }, { hover: false });
          hoveredPrecinct = undefined;
        }
      };
      const hoverPopup = new maplibregl.Popup({ closeButton: false, offset: 10, closeOnClick: false });
      m.on("mousemove", "precinct-extrude", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        m.getCanvas().style.cursor = "pointer";
        if (f.id !== hoveredPrecinct) {
          clearPrecinctHover();
          if (f.id !== undefined) {
            hoveredPrecinct = f.id;
            m.setFeatureState({ source: "precincts", id: hoveredPrecinct }, { hover: true });
          }
        }
        const pr = f.properties as { name?: string; turnout?: number };
        hoverPopup
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${pr.name ?? ""}</strong>${pr.turnout != null ? ` · ${pr.turnout}%` : ""}`)
          .addTo(m);
      });
      m.on("mouseleave", "precinct-extrude", () => {
        m.getCanvas().style.cursor = "";
        clearPrecinctHover();
        hoverPopup.remove();
      });
      m.on("click", "precinct-extrude", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        hoverPopup.remove();
        const pr = f.properties as { name: string; municipality?: string; turnout?: number; registered?: number; tier?: string; play?: string };
        const lines = [
          `<strong>${pr.name}</strong>`,
          pr.municipality ? pr.municipality : "",
          pr.turnout != null ? `Primary turnout (Aug '24): <strong>${pr.turnout}%</strong>` : "Turnout: n/a",
          pr.registered ? `Registered: ${pr.registered.toLocaleString()}` : "",
          pr.tier ? `Target tier <strong>${pr.tier}</strong>${pr.play ? ` · ${pr.play}` : ""}` : "",
          `<a href="/dashboard/targets?precinct=${encodeURIComponent(pr.name ?? "")}" style="display:inline-block;margin-top:6px;color:${BRAND.brick};font-weight:700;text-decoration:none">Target this precinct →</a>`,
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
          // Size by priority tier (P1 largest → P3 smallest) so high-value
          // appearances pop; default to P2 sizing if priority is missing.
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            9, ["match", ["get", "priority"], 1, 8, 2, 6, 3, 4.5, 6],
            13, ["match", ["get", "priority"], 1, 14, 2, 11, 3, 8, 11],
          ],
          // Draft events read lighter (gold) than published (green).
          "circle-color": ["case", ["==", ["get", "status"], "PUBLISHED"], EVENT_COLOR, EVENT_DRAFT],
          // Heavier ring on P1 reinforces the priority read.
          "circle-stroke-width": ["match", ["get", "priority"], 1, 3.5, 2.5],
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.9,
        },
      });
      m.on("mouseenter", "event-circles", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "event-circles", () => (m.getCanvas().style.cursor = ""));
      m.on("click", "event-circles", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { id: string; title: string; type: string; status: string; priority?: number; start: string; locationName?: string };
        const when = p.start ? new Date(p.start).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
        const lines = [
          `<strong>${p.title}</strong>`,
          `<span style="color:${EVENT_COLOR}">${EVENT_TYPE_LABEL[p.type] ?? "Event"}</span>${p.priority ? ` · <strong>P${p.priority}</strong>` : ""}${p.status !== "PUBLISHED" ? ` · <span style="color:${GOLD_INK}">${p.status.toLowerCase()}</span>` : ""}`,
          when,
          p.locationName ? p.locationName : "",
          `<a href="/dashboard/events/${encodeURIComponent(p.id)}" style="display:inline-block;margin-top:6px;color:${BRAND.brick};font-weight:700;text-decoration:none">Open event →</a>`,
        ].filter(Boolean);
        new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(lines.join("<br/>"))
          .addTo(m);
      });

      // Signs layer — saved placements from the Signs tool (Field → Signs).
      // Blue = verified (all three compliance gates), amber = pending.
      m.addSource("signs", { type: "geojson", data: signsRef.current });
      m.addLayer({
        id: "sign-circles",
        source: "signs",
        type: "circle",
        layout: { visibility: showSigns ? "visible" : "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4, 13, 8],
          "circle-color": ["case", ["==", ["get", "verified"], true], SIGN_COLOR.verified, SIGN_COLOR.pending],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.9,
        },
      });
      m.on("mouseenter", "sign-circles", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "sign-circles", () => (m.getCanvas().style.cursor = ""));
      m.on("click", "sign-circles", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name: string; type: string; verified: boolean; captainId?: string; notes?: string };
        const lines = [
          `<strong>${p.name}</strong>`,
          p.verified
            ? `<span style="color:${SIGN_COLOR.verified};font-weight:700">verified</span> · ${p.type}`
            : `<span style="color:${GOLD_INK};font-weight:700">pending verification</span> · ${p.type}`,
          p.captainId ? `Captain: ${p.captainId}` : "",
          p.notes ? p.notes : "",
          `<a href="/dashboard/signs" style="display:inline-block;margin-top:6px;color:${BRAND.brick};font-weight:700;text-decoration:none">Open sign tool →</a>`,
        ].filter(Boolean);
        new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(lines.join("<br/>"))
          .addTo(m);
      });

      ready.current = true;
      // Apply initial prop-driven visibility.
      syncVisibility();
      // Live precincts (or a focus deep link) may have arrived while the style
      // was still loading — the sources were seeded from refs above, but the
      // one-time district fit / pending focus still need to run.
      maybeFitOnLive();
      applyFocus();
    });

    return () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
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

  // Push live precinct turnout when it arrives; the first LIVE payload also
  // triggers the one-time district fit (sample fallback keeps the default frame).
  // Repaint too — tier/GOTV scale stops derive from the data (modeStats).
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("precincts") as maplibregl.GeoJSONSource | undefined)?.setData(precincts);
    applyPrecinctPaint();
    maybeFitOnLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precincts, precinctsLive]);

  // Mode switch = a paint swap on the one precinct layer (init-once preserved).
  useEffect(applyPrecinctPaint, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // One-shot focus command (deep link from Targets, or a search selection).
  useEffect(applyFocus, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Signs data + visibility.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("signs") as maplibregl.GeoJSONSource | undefined)?.setData(signs);
  }, [signs]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    if (m.getLayer("sign-circles")) m.setLayoutProperty("sign-circles", "visibility", showSigns ? "visible" : "none");
  }, [showSigns]);

  return <div ref={container} className="h-full w-full" />;
}
