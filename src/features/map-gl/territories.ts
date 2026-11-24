import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import type { Locale, TerritorySnapshot } from "@/domain/schema";
import { loadSnapshot } from "@/features/map/territories";
import { t } from "@/lib/i18n";
import { mix } from "@/theme/color";
import type { MapPalette } from "@/theme/mapPalettes";

type MapLib = typeof import("maplibre-gl");
type Slot = "a" | "b";

const FILL_OPACITY = 0.28;
const EDGE_OPACITY = 0.36;
const LINE_OPACITY = 0.62;
/** Snapshot crossfade (§7: old layer 1 → 0, new 0 → 1 in 600 ms). Morphing was left out, see FRONTEND_PLAN phase 4. */
export const CROSSFADE_MS = 600;

/**
 * Political map of a step: two identical layer stacks, the new snapshot is
 * drawn into the hidden one and the two crossfade. Borders read as
 * approximate: a soft colour band under a dashed ink line. Hover outlines a
 * polity through feature-state.
 */
export class TerritoryLayers {
  private active: Slot = "a";
  private shownId: string | null = null;
  private labels: { marker: Marker; el: HTMLElement }[] = [];
  private seq = 0;
  private fadeMs = CROSSFADE_MS;
  private hovered: { slot: Slot; id: string } | null = null;

  constructor(
    private readonly map: MlMap,
    private readonly lib: MapLib,
    private readonly locale: Locale,
    private palette: MapPalette,
    beforeLayer: string,
  ) {
    for (const slot of ["a", "b"] as const) {
      const src = `terr-${slot}`;
      map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] }, tolerance: 0.6, promoteId: "id" });
      const tr = { duration: CROSSFADE_MS, delay: 0 };
      map.addLayer({ id: `${src}-fill`, type: "fill", source: src, paint: { "fill-color": ["get", "fill"], "fill-opacity": 0, "fill-opacity-transition": tr, "fill-antialias": false } }, beforeLayer);
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
          paint: { "line-color": palette.ink, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 8, 1.4], "line-dasharray": [3, 2], "line-opacity": 0, "line-opacity-transition": tr },
        },
        beforeLayer,
      );
      map.addLayer(
        {
          id: `${src}-hover`,
          type: "line",
          source: src,
          layout: { "line-join": "round" },
          paint: { "line-color": palette.ink, "line-width": 2.2, "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.8, 0] },
        },
        beforeLayer,
      );
    }
    map.on("mousemove", `terr-a-fill`, (e) => this.hover("a", e.features?.[0]?.id));
    map.on("mousemove", `terr-b-fill`, (e) => this.hover("b", e.features?.[0]?.id));
    map.on("mouseleave", `terr-a-fill`, () => this.hover("a", undefined));
    map.on("mouseleave", `terr-b-fill`, () => this.hover("b", undefined));
  }

  private hover(slot: Slot, id: string | number | undefined) {
    if (slot !== this.active) return;
    if (this.hovered) this.map.setFeatureState({ source: `terr-${this.hovered.slot}`, id: this.hovered.id }, { hover: false });
    this.hovered = id === undefined ? null : { slot, id: String(id) };
    if (this.hovered) this.map.setFeatureState({ source: `terr-${slot}`, id: this.hovered.id }, { hover: true });
  }

  setPalette(palette: MapPalette) {
    this.palette = palette;
    for (const slot of ["a", "b"] as const) {
      this.map.setPaintProperty(`terr-${slot}-line`, "line-color", palette.ink);
      this.map.setPaintProperty(`terr-${slot}-hover`, "line-color", palette.ink);
    }
  }

  /** Instant swaps for reduced motion and light mode. */
  setInstant(instant: boolean) {
    this.fadeMs = instant ? 0 : CROSSFADE_MS;
    for (const slot of ["a", "b"] as const)
      for (const [layer, prop] of [["fill", "fill-opacity-transition"], ["edge", "line-opacity-transition"], ["line", "line-opacity-transition"]] as const)
        this.map.setPaintProperty(`terr-${slot}-${layer}`, prop, { duration: this.fadeMs, delay: 0 });
  }

  get currentId() {
    return this.shownId;
  }

  async show(id: string | null): Promise<void> {
    if (id === this.shownId) return;
    const seq = ++this.seq;
    if (!id) {
      this.setOpacity(this.active, false);
      this.shownId = null;
      this.swapLabels([]);
      return;
    }
    let snap: TerritorySnapshot;
    try {
      snap = await loadSnapshot(id);
    } catch {
      return; // offline or missing: the map stays without borders, the story goes on
    }
    if (seq !== this.seq) return;
    const next: Slot = this.active === "a" ? "b" : "a";
    (this.map.getSource(`terr-${next}`) as GeoJSONSource).setData(this.features(snap));
    this.hover(this.active, undefined);
    this.setOpacity(next, true);
    this.setOpacity(this.active, false);
    this.active = next;
    this.shownId = id;
    this.swapLabels(snap.polities.map((p) => ({ name: t(p.name, this.locale), at: p.labelAt, color: mix(p.color, this.palette.ink, 0.5), vassal: !!p.vassalOf })));
  }

  prefetch(id: string | null) {
    if (id) void loadSnapshot(id).catch(() => {});
  }

  private features(s: TerritorySnapshot): GeoJSON.FeatureCollection {
    return {
      type: "FeatureCollection",
      features: s.polities.map((p) => ({
        type: "Feature",
        properties: { id: p.id, name: t(p.name, this.locale), fill: p.vassalOf ? mix(p.color, this.palette.ground, 0.35) : p.color, edge: p.color },
        geometry: p.geometry as GeoJSON.Geometry,
      })),
    };
  }

  private setOpacity(slot: Slot, on: boolean) {
    this.map.setPaintProperty(`terr-${slot}-fill`, "fill-opacity", on ? FILL_OPACITY : 0);
    this.map.setPaintProperty(`terr-${slot}-edge`, "line-opacity", on ? EDGE_OPACITY : 0);
    this.map.setPaintProperty(`terr-${slot}-line`, "line-opacity", on ? LINE_OPACITY : 0);
  }

  /** Polity names as HTML, so Azerbaijani letters use the app font (no glyph server). */
  private swapLabels(items: { name: string; at: [number, number]; color: string; vassal: boolean }[]) {
    for (const { el, marker } of this.labels) {
      el.dataset.state = "out";
      window.setTimeout(() => marker.remove(), this.fadeMs + 100);
    }
    this.labels = items.map((it) => {
      const el = document.createElement("div");
      el.className = "gl-polity";
      el.dataset.vassal = String(it.vassal);
      el.style.color = it.color;
      el.textContent = it.name;
      el.dataset.state = "in";
      // Inline opacity from MapLibre lands on the host; the fade lives on the label.
      const host = document.createElement("div");
      host.appendChild(el);
      const marker = new this.lib.Marker({ element: host, anchor: "center" }).setLngLat(it.at).addTo(this.map);
      return { marker, el };
    });
  }
}
