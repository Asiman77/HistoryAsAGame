import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import type { Locale, TerritorySnapshot } from "@/domain/schema";
import { withBasePath } from "@/lib/basePath";
import { t } from "@/lib/i18n";

type MapLib = typeof import("maplibre-gl");
type Slot = "a" | "b";

const FILL_OPACITY = 0.3;
const EDGE_OPACITY = 0.38;
const LINE_OPACITY = 0.6;
const FADE_MS = 1400;

const cache = new Map<string, Promise<TerritorySnapshot>>();

/** Fetches one snapshot file (simplified GeoJSON, ~30 KB) and keeps it for the session. */
export function loadSnapshot(id: string): Promise<TerritorySnapshot> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(withBasePath(`/data/territories/${id}.json`)).then((r) => {
      if (!r.ok) throw new Error(`territory ${id}: ${r.status}`);
      return r.json() as Promise<TerritorySnapshot>;
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** Mixes a colour toward parchment; vassals are drawn paler than their overlord. */
function pale(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mixc = (c: number, p: number) => Math.round(c + (p - c) * amount);
  const r = mixc((n >> 16) & 255, 0xf2), g = mixc((n >> 8) & 255, 0xe6), b = mixc(n & 255, 0xcc);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function darker(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const d = (c: number) => Math.round(c * 0.55);
  return `rgb(${d((n >> 16) & 255)} ${d((n >> 8) & 255)} ${d(n & 255)})`;
}

function toFeatures(s: TerritorySnapshot, locale: Locale): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: s.polities.map((p) => ({
      type: "Feature",
      properties: { id: p.id, name: t(p.name, locale), fill: p.vassalOf ? pale(p.color, 0.35) : p.color, edge: p.color },
      geometry: p.geometry as GeoJSON.Geometry,
    })),
  };
}

/**
 * Two identical layer stacks; a new snapshot is drawn into the hidden one and
 * the two are crossfaded with MapLibre paint transitions. Borders are drawn as
 * a soft colour band under a dashed line to read as approximate, not surveyed.
 */
export class TerritoryLayers {
  private active: Slot = "a";
  private shownId: string | null = null;
  private labels: { marker: Marker; el: HTMLElement }[] = [];
  private seq = 0;
  private fadeMs = FADE_MS;

  constructor(
    private readonly map: MlMap,
    private readonly lib: MapLib,
    private readonly locale: Locale,
    private readonly beforeLayer: string,
  ) {
    for (const slot of ["a", "b"] as const) {
      const src = `terr-${slot}`;
      map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] }, tolerance: 0.6 });
      const tr = { duration: FADE_MS, delay: 0 };
      map.addLayer(
        {
          id: `${src}-fill`,
          type: "fill",
          source: src,
          paint: { "fill-color": ["get", "fill"], "fill-opacity": 0, "fill-opacity-transition": tr, "fill-antialias": false },
        },
        beforeLayer,
      );
      map.addLayer(
        {
          id: `${src}-edge`,
          type: "line",
          source: src,
          layout: { "line-join": "round" },
          paint: {
            "line-color": ["get", "edge"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 3, 4, 8, 10],
            "line-blur": ["interpolate", ["linear"], ["zoom"], 3, 3, 8, 8],
            "line-offset": ["interpolate", ["linear"], ["zoom"], 3, 1.5, 8, 4],
            "line-opacity": 0,
            "line-opacity-transition": tr,
          },
        },
        beforeLayer,
      );
      map.addLayer(
        {
          id: `${src}-line`,
          type: "line",
          source: src,
          layout: { "line-join": "round" },
          paint: {
            "line-color": "#5a4630",
            "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 8, 1.4],
            "line-dasharray": [3, 2],
            "line-opacity": 0,
            "line-opacity-transition": tr,
          },
        },
        beforeLayer,
      );
      // Focus outline: the state a state simulation is about.
      map.addLayer(
        {
          id: `${src}-focus`,
          type: "line",
          source: src,
          filter: ["==", ["get", "id"], "__none__"],
          layout: { "line-join": "round" },
          paint: { "line-color": ["get", "edge"], "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2.5, 8, 5], "line-opacity": 0.95 },
        },
        beforeLayer,
      );
      // Hover outline: a solid ink line around the polity under the pointer.
      map.addLayer(
        {
          id: `${src}-hover`,
          type: "line",
          source: src,
          filter: ["==", ["get", "id"], "__none__"],
          layout: { "line-join": "round" },
          paint: { "line-color": "#2a1c10", "line-width": 2.2, "line-opacity": 0.75 },
        },
        beforeLayer,
      );
    }
  }

  private hovered: string | null = null;
  private focused: string | null = null;
  private setFocusAfterSwap = false;

  /** Outlines one polity in the visible snapshot (null clears). */
  setFocus(id: string | null) {
    this.focused = id;
    for (const slot of ["a", "b"] as const)
      this.map.setFilter(`terr-${slot}-focus`, ["==", ["get", "id"], slot === this.active && id ? id : "__none__"]);
  }

  private setHover(id: string | null) {
    if (id === this.hovered) return;
    this.hovered = id;
    for (const slot of ["a", "b"] as const)
      this.map.setFilter(`terr-${slot}-hover`, ["==", ["get", "id"], slot === this.active && id ? id : "__none__"]);
  }

  /** Polity under a screen point in the visible snapshot. */
  private polityAt(point: { x: number; y: number }): { id: string; name: string } | null {
    if (!this.shownId) return null;
    const f = this.map.queryRenderedFeatures([point.x, point.y], { layers: [`terr-${this.active}-fill`] })[0];
    return f ? { id: String(f.properties.id), name: String(f.properties.name) } : null;
  }

  /** Hover shows the name and outlines the polity; click opens the ruler panel. */
  enableInteraction(onHover: (h: { name: string; x: number; y: number } | null) => void, onClick: (id: string) => void) {
    const canvas = this.map.getCanvas();
    this.map.on("mousemove", (e) => {
      const hit = this.polityAt(e.point);
      this.setHover(hit?.id ?? null);
      canvas.style.cursor = hit ? "pointer" : "";
      onHover(hit ? { name: hit.name, x: e.point.x, y: e.point.y } : null);
    });
    this.map.on("mouseout", () => {
      this.setHover(null);
    this.setFocusAfterSwap = true;
      canvas.style.cursor = "";
      onHover(null);
    });
    this.map.on("click", (e) => {
      const hit = this.polityAt(e.point);
      if (hit) onClick(hit.id);
    });
  }

  setInstant(instant: boolean) {
    this.fadeMs = instant ? 0 : FADE_MS;
    for (const slot of ["a", "b"] as const)
      for (const [layer, prop] of [["fill", "fill-opacity-transition"], ["edge", "line-opacity-transition"], ["line", "line-opacity-transition"]] as const)
        this.map.setPaintProperty(`terr-${slot}-${layer}`, prop, { duration: this.fadeMs, delay: 0 });
  }

  get currentId() {
    return this.shownId;
  }

  async show(id: string | null): Promise<TerritorySnapshot | null> {
    if (id === this.shownId) return null;
    const seq = ++this.seq;
    if (!id) {
      this.fadeOut(this.active);
      this.shownId = null;
      this.swapLabels([]);
      return null;
    }
    const snap = await loadSnapshot(id);
    if (seq !== this.seq) return null;
    const next: Slot = this.active === "a" ? "b" : "a";
    (this.map.getSource(`terr-${next}`) as GeoJSONSource).setData(toFeatures(snap, this.locale));
    this.setHover(null);
    this.fadeIn(next);
    this.fadeOut(this.active);
    this.active = next;
    this.shownId = id;
    if (this.setFocusAfterSwap) this.setFocus(this.focused);
    this.setFocusAfterSwap = false;
    this.swapLabels(
      snap.polities.map((p) => ({ name: t(p.name, this.locale), at: p.labelAt, color: darker(p.color), vassal: !!p.vassalOf })),
    );
    return snap;
  }

  private fadeIn(slot: Slot) {
    this.map.setPaintProperty(`terr-${slot}-fill`, "fill-opacity", FILL_OPACITY);
    this.map.setPaintProperty(`terr-${slot}-edge`, "line-opacity", EDGE_OPACITY);
    this.map.setPaintProperty(`terr-${slot}-line`, "line-opacity", LINE_OPACITY);
  }

  private fadeOut(slot: Slot) {
    this.map.setPaintProperty(`terr-${slot}-fill`, "fill-opacity", 0);
    this.map.setPaintProperty(`terr-${slot}-edge`, "line-opacity", 0);
    this.map.setPaintProperty(`terr-${slot}-line`, "line-opacity", 0);
  }

  /** Polity names as HTML so Azerbaijani letters use the app font; old ones fade out. */
  private swapLabels(items: { name: string; at: [number, number]; color: string; vassal: boolean }[]) {
    const old = this.labels;
    for (const { el, marker } of old) {
      el.dataset.state = "out";
      window.setTimeout(() => marker.remove(), this.fadeMs + 100);
    }
    this.labels = items.map((it) => {
      const host = document.createElement("div");
      const el = document.createElement("div");
      host.appendChild(el);
      el.className = "polity-label";
      el.dataset.state = "in";
      el.dataset.vassal = String(it.vassal);
      el.style.color = it.color;
      el.textContent = it.name;
      el.style.opacity = "0";
      const marker = new this.lib.Marker({ element: host, anchor: "center" }).setLngLat(it.at).addTo(this.map);
      requestAnimationFrame(() => requestAnimationFrame(() => (el.style.opacity = "")));
      return { marker, el };
    });
  }

  labelEntries() {
    return this.labels;
  }

  prefetch(id: string | null) {
    if (id) void loadSnapshot(id).catch(() => {});
  }
}
