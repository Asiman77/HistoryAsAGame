"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MlMap, Marker } from "maplibre-gl";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { Locale } from "@/domain/schema";
import { applyVariant, buildShellStyle } from "@/features/map-gl/style";
import { TerritoryLayers } from "@/features/map-gl/territories";
import { placeIconSvg } from "@/features/map/icons";
import { withBasePath } from "@/lib/basePath";
import { MAP_PALETTES } from "@/theme/mapPalettes";
import type { ZamanCapital, ZamanEra, ZamanEvent } from "./data";

type MapLib = typeof import("maplibre-gl");

const WORKER_URL = withBasePath("/vendor/maplibre-gl-worker.mjs");
/** The South Caucasus and Iran, where the content is. */
const START = { center: [49, 37.5] as [number, number], zoom: 4.1 };

export interface TimelineMapHandle {
  zoomIn(): void;
  zoomOut(): void;
}

export interface TimelineMapProps {
  locale: Locale;
  /** Snapshot drawn for the year; null when no map covers it. */
  snapshotId: string | null;
  variant: ZamanEra["mapVariant"];
  year: number;
  capitals: ZamanCapital[];
  /** Capitals of the year's snapshot. */
  capitalIds: string[];
  events: ZamanEvent[];
  layers: { borders: boolean; capitals: boolean; events: boolean };
  lite: boolean;
  reduced: boolean;
  onPolity: (polityId: string) => void;
  onEvent: (event: ZamanEvent) => void;
  onFail: () => void;
  ref?: Ref<TimelineMapHandle>;
}

interface Live {
  map: MlMap;
  lib: MapLib;
  terr: TerritoryLayers;
  variant: string;
  capitals: Marker[];
  events: Marker[];
}

/**
 * The year's political map on the timeline (§6.2): the period's parchment
 * style, borders that crossfade between snapshots, capitals with the name of
 * the year, the year's events. A click on a state (or its name, a button)
 * opens the ruler panel. The page waits ~120 ms after the slider moves before
 * it asks for another year, so dragging stays smooth.
 */
export function TimelineMap({ locale, snapshotId, variant, year, capitals, capitalIds, events, layers, lite, reduced, onPolity, onEvent, onFail, ref }: TimelineMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const live = useRef<Live | null>(null);
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onPolity, onEvent, onFail });
  useEffect(() => {
    callbacks.current = { onPolity, onEvent, onFail };
  });

  useEffect(() => {
    let map: MlMap | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const lib = await import("maplibre-gl");
        if (cancelled || !container.current) return;
        lib.setWorkerUrl(WORKER_URL);
        map = new lib.Map({
          container: container.current,
          style: buildShellStyle({ variant, hillshade: !lite }),
          center: START.center,
          zoom: START.zoom,
          minZoom: 2.5,
          maxZoom: 8,
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
        m.on("webglcontextlost", () => !cancelled && callbacks.current.onFail());
        m.once("load", () => {
          if (cancelled) return;
          m.addSource("anchor", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          m.addLayer({ id: "anchor", type: "circle", source: "anchor" });
          const terr = new TerritoryLayers(m, lib, locale, MAP_PALETTES[variant], "anchor", (id) => callbacks.current.onPolity(id));
          terr.setInstant(lite || reduced);
          live.current = { map: m, lib, terr, variant, capitals: [], events: [] };
          m.getContainer().dataset.ready = "true";
          setReady(true);
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
    // Built once; later props are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Period style and borders of the year.
  useEffect(() => {
    const l = live.current;
    if (!l) return;
    if (l.variant !== variant) {
      l.variant = variant;
      applyVariant(l.map, variant);
      l.terr.setPalette(MAP_PALETTES[variant]);
    }
    l.terr.setInstant(lite || reduced);
    void l.terr.show(layers.borders ? snapshotId : null);
  }, [ready, variant, lite, reduced, layers.borders, snapshotId]);

  // Capitals with the name they had in the year.
  useEffect(() => {
    const l = live.current;
    if (!l) return;
    for (const mk of l.capitals) mk.remove();
    l.capitals = layers.capitals
      ? capitals
          .filter((c) => capitalIds.includes(c.id))
          .map((c) => {
            const el = document.createElement("div");
            el.className = "gl-landmark";
            el.dataset.visible = "true";
            const name = c.periods.find((p) => year >= p.from && year <= p.to)?.name ?? c.periods[0]?.name ?? c.id;
            el.innerHTML = `<span class="gl-landmark-icon">${placeIconSvg("capital", 20)}</span><span class="gl-label"></span>`;
            el.querySelector(".gl-label")!.textContent = name;
            if (c.modern && c.modern !== name) el.title = c.modern;
            const host = document.createElement("div");
            host.appendChild(el);
            return new l.lib.Marker({ element: host, anchor: "center" }).setLngLat(c.center).addTo(l.map);
          })
      : [];
  }, [ready, layers.capitals, capitals, capitalIds, year]);

  // The year's events: buttons on the map.
  useEffect(() => {
    const l = live.current;
    if (!l) return;
    for (const mk of l.events) mk.remove();
    l.events = layers.events
      ? events.map((e) => {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "gl-event";
          el.dataset.category = e.category;
          el.setAttribute("aria-label", `${e.entity}: ${e.title}`);
          el.title = `${e.entity}: ${e.title}`;
          el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            callbacks.current.onEvent(e);
          });
          const host = document.createElement("div");
          host.appendChild(el);
          return new l.lib.Marker({ element: host, anchor: "center" }).setLngLat(e.center).addTo(l.map);
        })
      : [];
  }, [ready, layers.events, events]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => live.current?.map.zoomIn({ duration: reduced ? 0 : 300 }),
    zoomOut: () => live.current?.map.zoomOut({ duration: reduced ? 0 : 300 }),
  }));

  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" data-testid="gl-map" />
    </div>
  );
}
