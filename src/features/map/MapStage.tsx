"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Marker, PaddingOptions } from "maplibre-gl";
import type { EventType, Locale } from "@/domain/schema";
import type { LngLat } from "@/lib/geo";
import { t, type Messages } from "@/lib/i18n";
import type { MapPlace, Step } from "@/features/simulation/model";
import { ROUTE_COLORS, buildBaseStyle } from "./style";
import { boundsOf, cumulativeLengths, easeInOutCubic, sliceAlong } from "./polyline";

export type Phase = "journey" | "legacy";

interface Props {
  steps: Step[];
  places: MapPlace[];
  index: number;
  phase: Phase;
  padding: PaddingOptions;
  reducedMotion: boolean;
  locale: Locale;
  messages: Messages;
}

const ZOOM_BY_TYPE: Partial<Record<EventType, number>> = {
  battle: 6.6,
  birth: 6.2,
  death: 6.2,
  childhood: 6.4,
  education: 6.4,
  coronation: 6.2,
};
const DEFAULT_ZOOM = 5.8;
/** Copied from node_modules by scripts/copy-maplibre-worker.mjs. */
const WORKER_URL = "/vendor/maplibre-gl-worker.mjs";

type MarkerEntry = { marker: Marker; el: HTMLElement; place: MapPlace; priority: number };

/** Hides labels that would overlap a more important one (current place first, then most recent). */
function declutter(map: MlMap, entries: Iterable<MarkerEntry>) {
  const placed: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const visible = [...entries].filter((e) => e.el.dataset.state !== "future").sort((a, b) => b.priority - a.priority);
  for (const e of visible) {
    const p = map.project([e.place.place.lng, e.place.place.lat]);
    const label = e.el.querySelector<HTMLElement>(".label");
    const w = (label?.textContent?.length ?? 6) * (e.el.dataset.state === "current" ? 8.5 : 7.2);
    const box = { x1: p.x - w / 2 - 6, y1: p.y - 8, x2: p.x + w / 2 + 6, y2: p.y + 26 };
    const hit = placed.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1);
    e.el.dataset.label = hit ? "hidden" : "shown";
    if (!hit) placed.push(box);
  }
}

const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const lines = (routes: LngLat[][]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: routes.map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } })),
});

const SWORDS_SVG = `<svg class="swords" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2a1c10" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l11 11M15 15l2.5-.5L20 17l-3 3-2.5-2.5zM20 4L9 15M9 15l-2.5-.5L4 17l3 3 2.5-2.5z"/></svg>`;
const TRAVELLER_SVG = `<svg viewBox="0 0 32 32" width="30" height="30"><path d="M10 29V5" stroke="#2a1c10" stroke-width="2" stroke-linecap="round"/><path d="M11 5c6-2 9 3 16 1-2 4-2 6 0 10-7 2-10-3-16-1z" fill="#9b2c2c" stroke="#2a1c10" stroke-width="1.2" stroke-linejoin="round"/><circle cx="10" cy="29" r="2.6" fill="#b8862b" stroke="#2a1c10" stroke-width="1"/></svg>`;

/**
 * Imperative MapLibre stage. React owns *which* step is shown; this component
 * owns *how* the camera and routes get there, cancelling in-flight animations
 * whenever the step changes.
 */
export function MapStage({ steps, places, index, phase, padding, reducedMotion, locale, messages: m }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef(new Map<string, MarkerEntry>());
  const travellerRef = useRef<{ marker: Marker; el: HTMLElement } | null>(null);
  const tokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const prevRef = useRef<{ index: number; phase: Phase } | null>(null);
  const paddingRef = useRef(padding);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useLayoutEffect(() => {
    paddingRef.current = padding;
  }, [padding]);

  // ---- one-time map setup -------------------------------------------------
  useEffect(() => {
    let disposed = false;
    let map: MlMap | undefined;
    const markers = markersRef.current;
    const loadTimer = window.setTimeout(() => !disposed && setStatus((s) => (s === "loading" ? "error" : s)), 20000);

    (async () => {
      const maplibregl = await import("maplibre-gl");
      maplibregl.setWorkerUrl(WORKER_URL);
      if (disposed || !containerRef.current) return;
      const first = steps[0]!.event.location;
      const created = new maplibregl.Map({
        container: containerRef.current,
        style: buildBaseStyle(),
        center: [first.lng, first.lat],
        zoom: 3.4,
        minZoom: 2.5,
        maxZoom: 9,
        dragRotate: false,
        pitchWithRotate: false,
        renderWorldCopies: false,
        attributionControl: { compact: true },
        fadeDuration: 0,
      });
      map = created;
      map.touchZoomRotate.disableRotation();
      map.keyboard.disable(); // arrow keys drive the story, not the map
      mapRef.current = map;

      map.on("load", () => {
        if (disposed || !map) return;
        map.addSource("trail", { type: "geojson", data: empty });
        map.addSource("active", { type: "geojson", data: empty });
        map.addLayer({
          id: "trail",
          type: "line",
          source: "trail",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ROUTE_COLORS.trail, "line-width": 2, "line-opacity": 0.45, "line-dasharray": [1.5, 2] },
        });
        map.addLayer({
          id: "active-casing",
          type: "line",
          source: "active",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ROUTE_COLORS.activeCasing, "line-width": 7, "line-opacity": 0.9 },
        });
        map.addLayer({
          id: "active",
          type: "line",
          source: "active",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ROUTE_COLORS.active, "line-width": 3.2 },
        });

        for (const place of places) {
          // MapLibre owns the marker element's transform/opacity, so state lives on an inner node.
          const host = document.createElement("div");
          const el = document.createElement("div");
          host.appendChild(el);
          el.className = "place-marker";
          el.dataset.state = "future";
          el.innerHTML = `${SWORDS_SVG}<span class="dot"></span><span class="label"></span>`;
          el.querySelector(".label")!.textContent = t(place.place.name, locale);
          const marker = new maplibregl.Marker({ element: host, anchor: "top", offset: [0, -7] })
            .setLngLat([place.place.lng, place.place.lat])
            .addTo(map);
          markers.set(place.key, { marker, el, place, priority: -1 });
        }

        const thost = document.createElement("div");
        const tel = document.createElement("div");
        thost.appendChild(tel);
        tel.className = "traveller";
        tel.innerHTML = TRAVELLER_SVG;
        tel.style.opacity = "0";
        const traveller = new maplibregl.Marker({ element: thost, anchor: "bottom-left", offset: [-9, -4] })
          .setLngLat([first.lng, first.lat])
          .addTo(map);
        travellerRef.current = { marker: traveller, el: tel };

        let pending = false;
        map.on("move", () => {
          if (pending) return;
          pending = true;
          requestAnimationFrame(() => {
            pending = false;
            if (map) declutter(map, markers.values());
          });
        });

        setStatus("ok");
        setReady(true);
      });
    })();

    return () => {
      disposed = true;
      window.clearTimeout(loadTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      markers.clear();
      travellerRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // The map is created once per person page; steps/places are static props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- play a step whenever index/phase changes ---------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const token = ++tokenRef.current;
    const alive = () => token === tokenRef.current;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    map.stop();

    const prev = prevRef.current;
    prevRef.current = { index, phase };
    const trail = map.getSource("trail") as GeoJSONSource;
    const active = map.getSource("active") as GeoJSONSource;
    const traveller = travellerRef.current!;
    const step = steps[index]!;
    const loc: LngLat = [step.event.location.lng, step.event.location.lat];

    const camera = (run: () => void, maxMs: number) =>
      new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          map.off("moveend", finish);
          window.clearTimeout(timer);
          resolve();
        };
        const timer = window.setTimeout(finish, maxMs + 400);
        map.on("moveend", finish);
        run();
      });

    const setMarkers = (revealCurrent: boolean) => {
      for (const entry of markersRef.current.values()) {
        const { el, place } = entry;
        let state: "future" | "past" | "current";
        if (phase === "legacy") state = "past";
        else if (place.steps.includes(index)) state = revealCurrent || place.firstStep < index ? "current" : "future";
        else state = place.firstStep < index ? "past" : "future";
        el.dataset.state = state;
        el.dataset.battle = String(phase === "journey" && state === "current" && step.event.type === "battle");
        const seen = place.steps.filter((i) => i <= index);
        entry.priority = state === "current" ? Infinity : phase === "legacy" ? place.steps.length : (seen.at(-1) ?? -1);
      }
      declutter(map, markersRef.current.values());
    };

    const drawRoute = (coords: LngLat[], ms: number) =>
      new Promise<void>((resolve) => {
        const cum = cumulativeLengths(coords);
        const start = performance.now();
        traveller.el.style.opacity = "1";
        const frame = (now: number) => {
          if (!alive()) return resolve();
          const p = Math.min((now - start) / ms, 1);
          const { partial, head } = sliceAlong(coords, cum, easeInOutCubic(p));
          active.setData(lines([partial]));
          traveller.marker.setLngLat(head);
          if (p < 1) rafRef.current = requestAnimationFrame(frame);
          else resolve();
        };
        rafRef.current = requestAnimationFrame(frame);
      });

    const pad = paddingRef.current;
    const fly = (target: LngLat, zoom: number) =>
      camera(
        () =>
          reducedMotion
            ? map.jumpTo({ center: target, zoom, padding: pad })
            : map.flyTo({ center: target, zoom, padding: pad, speed: 0.9, curve: 1.4, maxDuration: 2800, essential: true }),
        2800,
      );

    // --- legacy: the whole life at once ---
    if (phase === "legacy") {
      const routes = steps.flatMap((s) => (s.route ? [s.route] : []));
      trail.setData(empty);
      active.setData(lines(routes));
      traveller.el.style.opacity = "0";
      setMarkers(true);
      const all = [...routes.flat(), ...places.map((p) => [p.place.lng, p.place.lat] as LngLat)];
      map.fitBounds(boundsOf(all), { padding: pad, duration: reducedMotion ? 0 : 2200, maxZoom: 6 });
      return;
    }

    // --- journey ---
    const past = steps.slice(0, index).flatMap((s) => (s.route ? [s.route] : []));
    trail.setData(lines(past));
    active.setData(empty);

    const firstRun = prev === null;
    const forwardOne = !firstRun && prev.phase === "journey" && index === prev.index + 1;
    const zoom = ZOOM_BY_TYPE[step.event.type] ?? DEFAULT_ZOOM;

    (async () => {
      if (firstRun && !reducedMotion) {
        // Opening shot: the whole life in one frame, then descend to the first stop.
        const all = places.map((p) => [p.place.lng, p.place.lat] as LngLat);
        map.fitBounds(boundsOf(all), { padding: pad, duration: 0, maxZoom: 5 });
        await new Promise((r) => setTimeout(r, 700));
        if (!alive()) return;
      }

      if (step.route && forwardOne && !reducedMotion) {
        setMarkers(false);
        traveller.marker.setLngLat(step.route[0]!);
        await camera(
          () => map.fitBounds(boundsOf(step.route!), { padding: pad, maxZoom: 6.2, duration: 1300, easing: easeInOutCubic }),
          1300,
        );
        if (!alive()) return;
        const ms = Math.min(Math.max(1400 + step.distanceKm * 0.9, 1800), 4200);
        await drawRoute(step.route, ms);
        if (!alive()) return;
        setMarkers(true);
        await fly(loc, zoom);
        return;
      }

      // Jumps, backwards moves, stationary events and reduced motion.
      if (step.route) active.setData(lines([step.route]));
      setMarkers(true);
      traveller.marker.setLngLat(loc);
      traveller.el.style.opacity = "1";
      await fly(loc, zoom);
    })();
  }, [ready, index, phase, steps, places, reducedMotion]);

  // Keep the focused location clear of panels when the layout changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || map.isMoving()) return;
    map.easeTo({ padding, duration: reducedMotion ? 0 : 400 });
  }, [ready, padding, reducedMotion]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" aria-label={m.sim.timeline} role="region" />
      {status !== "ok" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="paper-card rounded px-4 py-2 text-sm text-ink-soft" role="status">
            {status === "loading" ? m.map.loading : m.map.error}
          </p>
        </div>
      )}
    </div>
  );
}
