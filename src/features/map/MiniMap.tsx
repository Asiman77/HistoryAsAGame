"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MlMap } from "maplibre-gl";
import { withBasePath } from "@/lib/basePath";
import { buildBaseStyle, type MapStyleVariant } from "./style";

const WORKER_URL = withBasePath("/vendor/maplibre-gl-worker.mjs");

export interface MiniMarker {
  lng: number;
  lat: number;
  label?: string;
  color?: string;
  /** Small dot instead of a pin (many steps of one lane). */
  dot?: boolean;
}

export interface MiniLine {
  coords: [number, number][];
  color: string;
  dashed?: boolean;
}

/**
 * A small, still map for pages that are not simulations (a place, a
 * comparison): base map in the period's colours plus a few markers.
 * Loaded lazily; until it is ready the box shows the parchment ground.
 */
export function MiniMap({
  center,
  zoom = 5,
  markers,
  lines = [],
  fit,
  variant = "manuscript",
  className = "",
  label,
  attribution,
}: {
  center: [number, number];
  zoom?: number;
  markers: MiniMarker[];
  lines?: MiniLine[];
  /** [[west, south], [east, north]]: frames these bounds instead of center/zoom. */
  fit?: [[number, number], [number, number]];
  variant?: MapStyleVariant;
  className?: string;
  label: string;
  attribution: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const key = JSON.stringify({ center, zoom, markers, lines, fit, variant });

  useEffect(() => {
    let map: MlMap | undefined;
    let disposed = false;
    const { center: c, zoom: z, markers: ms, lines: ls, fit: f, variant: v } = JSON.parse(key) as {
      center: [number, number];
      zoom: number;
      markers: MiniMarker[];
      lines: MiniLine[];
      fit?: [[number, number], [number, number]];
      variant: MapStyleVariant;
    };
    (async () => {
      const lib = await import("maplibre-gl");
      lib.setWorkerUrl(WORKER_URL);
      if (disposed || !ref.current) return;
      map = new lib.Map({
        container: ref.current,
        style: buildBaseStyle({ hillshade: false, variant: v }),
        center: c,
        zoom: z,
        ...(f ? { bounds: f, fitBoundsOptions: { padding: 28, maxZoom: 7 } } : {}),
        interactive: false,
        // Credits are printed under the box by the caller (they would cover a small map).
        attributionControl: false,
        renderWorldCopies: false,
        fadeDuration: 0,
      });
      map.on("load", () => {
        if (disposed || !map) return;
        ls.forEach((line, i) => {
          map!.addSource(`line-${i}`, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line.coords } } });
          map!.addLayer({
            id: `line-${i}`,
            type: "line",
            source: `line-${i}`,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": line.color, "line-width": 2.5, "line-opacity": 0.85, ...(line.dashed ? { "line-dasharray": [2, 1.5] } : {}) },
          });
        });
        setReady(true);
      });
      for (const mk of ms) {
        const el = document.createElement("div");
        el.className = mk.dot ? "mini-marker mini-dot" : "mini-marker";
        el.style.setProperty("--marker-color", mk.color ?? "var(--color-carmine)");
        if (mk.label) {
          const span = document.createElement("span");
          span.textContent = mk.label;
          el.appendChild(span);
        }
        new lib.Marker({ element: el, anchor: mk.dot ? "center" : "bottom" }).setLngLat([mk.lng, mk.lat]).addTo(map);
      }
    })();
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [key]);

  return (
    <figure className={`flex flex-col ${className}`}>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-ink/15 bg-parchment-dark" role="img" aria-label={label}>
        {/* maplibre sets position: relative on its container, so size it directly rather than with inset-0. */}
        <div ref={ref} className="h-full w-full" />
        {!ready && <div aria-hidden className="texture-parchment absolute inset-0" />}
      </div>
      <figcaption className="mt-1 text-[10px] leading-tight text-ink-faint">{attribution}</figcaption>
    </figure>
  );
}
