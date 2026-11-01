import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import type { Locale, Maneuver } from "@/domain/schema";
import type { LngLat } from "@/lib/geo";
import { t } from "@/lib/i18n";
import { cumulativeLengths, easeInOutCubic, sliceAlong } from "./polyline";

type MapLib = typeof import("maplibre-gl");

const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** Screen-space bearing (degrees clockwise from up) of the last segment in Web Mercator. */
export function headingDeg(a: LngLat, b: LngLat): number {
  const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const dx = ((b[0] - a[0]) * Math.PI) / 180;
  const dy = merc(b[1]) - merc(a[1]);
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

function arrowImage(color: string): ImageData {
  const size = 48;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.beginPath();
  g.moveTo(size / 2, 4);
  g.lineTo(size - 8, size - 10);
  g.lineTo(size / 2, size - 18);
  g.lineTo(8, size - 10);
  g.closePath();
  g.fillStyle = color;
  g.strokeStyle = "#f8f0dd";
  g.lineWidth = 3;
  g.lineJoin = "round";
  g.stroke();
  g.fill();
  return g.getImageData(0, 0, size, size);
}

export interface BattleColors {
  own: string;
  enemy: string;
}

/**
 * Schematic troop movements: each arrow grows along its path, then gets a
 * head. Retreats are dashed. No casualties or violence are drawn.
 */
export class BattleLayer {
  private labels: Marker[] = [];

  constructor(
    private readonly map: MlMap,
    private readonly lib: MapLib,
    private readonly locale: Locale,
  ) {
    map.addSource("battle-lines", { type: "geojson", data: empty });
    map.addSource("battle-heads", { type: "geojson", data: empty });
    map.addLayer({
      id: "battle-casing",
      type: "line",
      source: "battle-lines",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#f8f0dd", "line-width": 9, "line-opacity": 0.85 },
    });
    map.addLayer({
      id: "battle-solid",
      type: "line",
      source: "battle-lines",
      filter: ["!=", ["get", "kind"], "retreat"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 5 },
    });
    map.addLayer({
      id: "battle-dashed",
      type: "line",
      source: "battle-lines",
      filter: ["==", ["get", "kind"], "retreat"],
      layout: { "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 4, "line-dasharray": [1.4, 1.2] },
    });
    map.addLayer({
      id: "battle-heads",
      type: "symbol",
      source: "battle-heads",
      layout: {
        "icon-image": ["get", "icon"],
        "icon-rotate": ["get", "heading"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-size": 0.62,
      },
    });
  }

  private icon(color: string): string {
    const id = `arrow-${color.replace("#", "")}`;
    if (!this.map.hasImage(id)) this.map.addImage(id, arrowImage(color), { pixelRatio: 2 });
    return id;
  }

  clear() {
    (this.map.getSource("battle-lines") as GeoJSONSource | undefined)?.setData(empty);
    (this.map.getSource("battle-heads") as GeoJSONSource | undefined)?.setData(empty);
    for (const l of this.labels) l.remove();
    this.labels = [];
  }

  /** Draws the arrows one after another; resolves early when `alive()` turns false. */
  async play(maneuvers: Maneuver[], colors: BattleColors, alive: () => boolean, instant: boolean, onArrow?: (m: Maneuver) => void) {
    this.clear();
    const lines = this.map.getSource("battle-lines") as GeoJSONSource;
    const heads = this.map.getSource("battle-heads") as GeoJSONSource;
    const done: GeoJSON.Feature[] = [];
    const headFeatures: GeoJSON.Feature[] = [];
    const feature = (m: Maneuver, coords: LngLat[]): GeoJSON.Feature => ({
      type: "Feature",
      properties: { kind: m.kind, color: colors[m.side] },
      geometry: { type: "LineString", coordinates: coords },
    });

    for (const m of maneuvers) {
      if (!alive()) return;
      const coords = m.path as LngLat[];
      onArrow?.(m);
      if (!instant) {
        const cum = cumulativeLengths(coords);
        const ms = 950;
        const start = performance.now();
        await new Promise<void>((resolve) => {
          const frame = (now: number) => {
            if (!alive()) return resolve();
            const p = Math.min((now - start) / ms, 1);
            const { partial } = sliceAlong(coords, cum, easeInOutCubic(p));
            lines.setData({ type: "FeatureCollection", features: [...done, feature(m, partial)] });
            if (p < 1) requestAnimationFrame(frame);
            else resolve();
          };
          requestAnimationFrame(frame);
        });
        if (!alive()) return;
      }
      done.push(feature(m, coords));
      lines.setData({ type: "FeatureCollection", features: done });
      const end = coords.at(-1)!;
      headFeatures.push({
        type: "Feature",
        properties: { icon: this.icon(colors[m.side]), heading: headingDeg(coords.at(-2)!, end) },
        geometry: { type: "Point", coordinates: end },
      });
      heads.setData({ type: "FeatureCollection", features: headFeatures });
      if (m.label) this.addLabel(coords[Math.floor(coords.length / 2)]!, t(m.label, this.locale), colors[m.side]);
      if (!instant) await new Promise((r) => setTimeout(r, 220));
    }
  }

  private addLabel(at: LngLat, text: string, color: string) {
    const host = document.createElement("div");
    const el = document.createElement("div");
    host.appendChild(el);
    el.className = "battle-label";
    el.style.borderColor = color;
    el.textContent = text;
    this.labels.push(new this.lib.Marker({ element: host, anchor: "bottom", offset: [0, -8] }).setLngLat(at).addTo(this.map));
  }
}
