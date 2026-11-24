"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { ExpressionSpecification, GeoJSONSource, Map as MlMap } from "maplibre-gl";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { Locale } from "@/domain/schema";
import { cumulativeLengths, sliceAlong } from "@/features/map/polyline";
import { easeInOutCubic, type MapPadding } from "@/features/simulation-shell/map/SvgMap";
import type { LngLat, MapController, ShellData } from "@/features/simulation-shell/types";
import { withBasePath } from "@/lib/basePath";
import { MAP_PALETTES } from "@/theme/mapPalettes";
import { ShellMarkers } from "./markers";
import { applyVariant, buildShellStyle } from "./style";
import { TerritoryLayers } from "./territories";

type MapLib = typeof import("maplibre-gl");

/** Copied from node_modules by scripts/copy-maplibre-worker.mjs. */
const WORKER_URL = withBasePath("/vendor/maplibre-gl-worker.mjs");
const CLEAR = "rgba(0,0,0,0)";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const lines = (routes: LngLat[][]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: routes.map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } })),
});

/** line-gradient that shows the line up to `p` (0..1) of its length (§7: line-gradient + lineMetrics). */
function progressGradient(p: number, color: string): ExpressionSpecification {
  if (p <= 0) return ["interpolate", ["linear"], ["line-progress"], 0, CLEAR, 1, CLEAR];
  if (p >= 1) return ["interpolate", ["linear"], ["line-progress"], 0, color, 1, color];
  return ["interpolate", ["linear"], ["line-progress"], 0, color, p, color, Math.min(1, p + 0.002), CLEAR, 1, CLEAR];
}

/** Current value of a theme token on <html> (the route wears the period's second colour). */
const token = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

interface Props {
  data: ShellData;
  locale: Locale;
  padding: MapPadding;
  /** Light mode: no hillshade, 1x pixels, instant border swaps. */
  lite: boolean;
  reduced: boolean;
  onReady: () => void;
  /** The map could not start (no WebGL, worker blocked): the shell falls back to the SVG map. */
  onFail: () => void;
  /** A place marker was clicked (city card). */
  onPlace: (placeId: string) => void;
  ref?: Ref<MapController>;
}

interface Live {
  map: MlMap;
  lib: MapLib;
  terr: TerritoryLayers;
  markers: ShellMarkers;
  variant: string;
  index: number;
}

/**
 * MapLibre stage of the simulation (§7) behind MapController: our own
 * parchment style per period, political snapshots that crossfade, faded
 * trails of past routes, the current route drawn through line-gradient with
 * a rider, HTML markers. Loaded with a dynamic import on simulation routes only.
 */
export function MapLibreMap({ data, locale, padding, lite, reduced, onReady, onFail, onPlace, ref }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const live = useRef<Live | null>(null);
  const routeCum = useRef<number[]>([]);
  const routeColor = useRef("");
  const callbacks = useRef({ onReady, onFail, onPlace });
  const pad = useRef(padding);
  useEffect(() => {
    callbacks.current = { onReady, onFail, onPlace };
  });

  useEffect(() => {
    let map: MlMap | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const lib = await import("maplibre-gl");
        if (cancelled || !container.current) return;
        lib.setWorkerUrl(WORKER_URL);
        const first = data.steps[0]!;
        map = new lib.Map({
          container: container.current,
          style: buildShellStyle({ variant: first.mapVariant, hillshade: !lite }),
          center: first.center,
          zoom: first.zoom,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          renderWorldCopies: false,
          attributionControl: false,
          fadeDuration: 0,
          ...(lite ? { pixelRatio: 1 } : {}),
        });
        map.addControl(new lib.AttributionControl({ compact: true }), "bottom-left");
        const m = map;
        m.once("load", () => {
          if (cancelled) return;
          const palette = MAP_PALETTES[first.mapVariant];
          m.addSource("trails", { type: "geojson", data: EMPTY });
          m.addLayer({ id: "trails", type: "line", source: "trails", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": palette.ink, "line-opacity": 0.45, "line-width": 1.8, "line-dasharray": [1.5, 2.5] } });
          m.addSource("route", { type: "geojson", data: EMPTY, lineMetrics: true });
          m.addLayer({ id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 7, "line-gradient": progressGradient(0, palette.halo) } });
          m.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 3.5, "line-gradient": progressGradient(0, palette.ink) } });
          const terr = new TerritoryLayers(m, lib, locale, palette, "trails");
          terr.setInstant(lite || reduced);
          const markers = new ShellMarkers(m, lib, data.landmarks, data.places, (id) => callbacks.current.onPlace(id));
          live.current = { map: m, lib, terr, markers, variant: first.mapVariant, index: -1 };
          // Padding given before the map existed (desktop panel, phone sheet) applies now.
          m.setPadding(pad.current);
          m.getContainer().dataset.ready = "true";
          callbacks.current.onReady();
        });
      } catch {
        if (!cancelled) callbacks.current.onFail();
      }
    })();
    return () => {
      cancelled = true;
      live.current = null;
      map?.remove();
    };
    // The map is built once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    pad.current = padding;
    live.current?.map.setPadding(padding);
  }, [padding]);

  useEffect(() => {
    live.current?.terr.setInstant(lite || reduced);
  }, [lite, reduced]);

  const paintRoute = (p: number) => {
    const l = live.current;
    const s = l ? data.steps[l.index] : undefined;
    if (!l || !s?.route || s.route.length < 2) return;
    const palette = MAP_PALETTES[s.mapVariant];
    l.map.setPaintProperty("route-casing", "line-gradient", progressGradient(p, palette.halo));
    l.map.setPaintProperty("route-line", "line-gradient", progressGradient(p, routeColor.current));
    l.markers.showRider(p > 0 && p < 1 ? sliceAlong(s.route, routeCum.current, p).head : null);
  };

  useImperativeHandle(
    ref,
    (): MapController => ({
      showStep(i) {
        const l = live.current;
        const s = data.steps[i];
        if (!l || !s) return;
        l.index = i;
        (l.map.getSource("trails") as GeoJSONSource).setData(lines(data.steps.filter((x) => x.index < i && x.route && x.route.length > 1).map((x) => x.route!)));
        (l.map.getSource("route") as GeoJSONSource).setData(s.route && s.route.length > 1 ? lines([s.route]) : EMPTY);
        routeCum.current = s.route ? cumulativeLengths(s.route) : [];
        routeColor.current = token("--secondary", MAP_PALETTES[s.mapVariant].ink);
        paintRoute(0);
        if (s.mapVariant !== l.variant) {
          l.variant = s.mapVariant;
          applyVariant(l.map, s.mapVariant);
          l.terr.setPalette(MAP_PALETTES[s.mapVariant]);
          l.map.setPaintProperty("trails", "line-color", MAP_PALETTES[s.mapVariant].ink);
        }
        void l.terr.show(s.snapshotId);
        l.terr.prefetch(data.steps[i + 1]?.snapshotId ?? null);
        l.markers.update(i, s.year, s.center, s.placeName, s.snapshotId ? (data.capitals[s.snapshotId] ?? []) : [], s.placeId);
      },
      flyTo(view, duration, signal) {
        const l = live.current;
        if (!l) return Promise.resolve();
        if (duration <= 0 || signal.aborted) {
          l.map.jumpTo({ center: view.center, zoom: view.zoom });
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          const done = () => {
            signal.removeEventListener("abort", jump);
            resolve();
          };
          const jump = () => {
            l.map.off("moveend", done);
            l.map.stop();
            l.map.jumpTo({ center: view.center, zoom: view.zoom });
            resolve();
          };
          l.map.once("moveend", done);
          signal.addEventListener("abort", jump, { once: true });
          l.map.flyTo({ center: view.center, zoom: view.zoom, duration, curve: 1.4, easing: easeInOutCubic, essential: true });
        });
      },
      drawRoute(i, duration, signal) {
        const l = live.current;
        if (!l || l.index !== i) return Promise.resolve();
        if (duration <= 0 || signal.aborted) {
          paintRoute(1);
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          const t0 = performance.now();
          let raf = 0;
          const end = () => {
            cancelAnimationFrame(raf);
            if (live.current?.index === i) paintRoute(1);
            resolve();
          };
          const frame = (now: number) => {
            if (live.current?.index !== i) return end();
            const t = Math.min(1, (now - t0) / duration);
            paintRoute(easeInOutCubic(t));
            if (t < 1) raf = requestAnimationFrame(frame);
            else end();
          };
          signal.addEventListener("abort", end, { once: true });
          raf = requestAnimationFrame(frame);
        });
      },
    }),
    // Methods read the live map through refs; the step data never changes during a visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // MapLibre sets position: relative on its container, so the container fills an absolute wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" data-testid="gl-map" />
    </div>
  );
}
