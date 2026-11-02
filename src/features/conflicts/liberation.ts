import type { Map as MlMap, Marker } from "maplibre-gl";
import type { Locale, Settlement } from "@/domain/schema";
import type { MapExtension, MapExtensionFactory } from "@/features/map/MapStage";
import { t } from "@/lib/i18n";

/** Azerbaijani flag colours. */
export const FLAG = { blue: "#00B5E2", red: "#EF3340", green: "#509E2F" } as const;
const OCCUPIED = "#6b6b6b";

/**
 * Liberated settlements of a war. Every settlement named in the official
 * statements is drawn grey until the day it was announced, then in the
 * flag's green with a blue ring; the settlements of the current day get an
 * expanding red-blue "wave" and their names. No front line is drawn: there is
 * no reliable open data for it.
 */
export function liberationLayer(settlements: Settlement[], liberatedAt: Record<string, number>): MapExtensionFactory {
  return (map: MlMap, lib, locale: Locale): MapExtension => {
    const placed = settlements.filter((s) => s.lat !== undefined && s.lng !== undefined && liberatedAt[s.id] !== undefined);
    map.addSource("liberation", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: placed.map((s) => ({
          type: "Feature",
          properties: { id: s.id, at: liberatedAt[s.id], big: s.kind === "city" || s.kind === "town" || s.kind === "district" ? 1 : 0 },
          geometry: { type: "Point", coordinates: [s.lng!, s.lat!] },
        })),
      },
    });
    // Zoom must be the top-level input in MapLibre; the size class is decided inside each stop.
    const big = ["==", ["get", "big"], 1];
    const radius = ["interpolate", ["linear"], ["zoom"], 6, ["case", big, 4.5, 2.6], 10, ["case", big, 9, 5.5]];
    map.addLayer({
      id: "lib-wave",
      type: "circle",
      source: "liberation",
      filter: ["==", ["get", "at"], -1],
      paint: { "circle-radius": 6, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": FLAG.red, "circle-stroke-width": 2, "circle-stroke-opacity": 0.9 },
    });
    map.addLayer({
      id: "lib-dots",
      type: "circle",
      source: "liberation",
      paint: {
        "circle-radius": radius as never,
        "circle-color": OCCUPIED,
        "circle-stroke-color": "#2a2a2a",
        "circle-stroke-width": 1,
        "circle-opacity": 0.9,
      },
    });

    let labels: Marker[] = [];
    let raf: number | null = null;
    const byStep = (i: number) => placed.filter((s) => liberatedAt[s.id] === i);

    return {
      update(index, final, instant) {
        const upTo = final ? Number.MAX_SAFE_INTEGER : index;
        map.setPaintProperty("lib-dots", "circle-color", ["case", ["<=", ["get", "at"], upTo], FLAG.green, OCCUPIED]);
        map.setPaintProperty("lib-dots", "circle-stroke-color", ["case", ["<=", ["get", "at"], upTo], FLAG.blue, "#2a2a2a"]);
        map.setPaintProperty("lib-dots", "circle-stroke-width", ["case", ["<=", ["get", "at"], upTo], 1.6, 0.8]);
        map.setFilter("lib-wave", ["==", ["get", "at"], final ? -1 : index]);

        for (const l of labels) l.remove();
        labels = [];
        if (raf) cancelAnimationFrame(raf);
        if (final) return;

        const now = byStep(index);
        // Names only where they fit: towns first, then a handful of villages.
        const named = [...now].sort((a, b) => (b.kind === "village" ? 0 : 1) - (a.kind === "village" ? 0 : 1)).slice(0, 10);
        labels = named.map((s) => {
          const host = document.createElement("div");
          const el = document.createElement("div");
          host.appendChild(el);
          el.className = "liberation-label";
          el.textContent = t(s.name, locale);
          return new lib.Marker({ element: host, anchor: "top", offset: [0, 6] }).setLngLat([s.lng!, s.lat!]).addTo(map);
        });

        if (instant || now.length === 0) {
          map.setPaintProperty("lib-wave", "circle-radius", 10);
          map.setPaintProperty("lib-wave", "circle-stroke-opacity", 0.7);
          return;
        }
        // Two expanding rings, red then blue: the "wave" of liberation.
        const start = performance.now();
        const frame = (t0: number) => {
          const p = ((t0 - start) % 1400) / 1400;
          const pass = Math.floor((t0 - start) / 1400);
          map.setPaintProperty("lib-wave", "circle-radius", 4 + p * 22);
          map.setPaintProperty("lib-wave", "circle-stroke-opacity", 0.9 * (1 - p));
          map.setPaintProperty("lib-wave", "circle-stroke-color", pass % 2 ? FLAG.blue : FLAG.red);
          if (pass < 4) raf = requestAnimationFrame(frame);
          else map.setPaintProperty("lib-wave", "circle-stroke-opacity", 0);
        };
        raf = requestAnimationFrame(frame);
      },
    };
  };
}
