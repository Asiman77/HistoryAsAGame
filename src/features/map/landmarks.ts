import type { Map as MlMap, Marker } from "maplibre-gl";
import type { Locale, Place, PlaceType } from "@/domain/schema";
import { t, type Messages } from "@/lib/i18n";
import { isPlaceVisibleIn, placeNameIn } from "@/lib/places";
import { placeIconSvg } from "./icons";

type MapLib = typeof import("maplibre-gl");

/** Minimum zoom per importance: from afar only capitals and major cities. */
const MIN_ZOOM: Record<1 | 2 | 3, number> = { 1: 0, 2: 4.7, 3: 5.9 };

export interface LandmarkEntry {
  place: Place;
  marker: Marker;
  el: HTMLButtonElement;
}

export class LandmarkLayer {
  private entries: LandmarkEntry[] = [];
  private year = 0;
  private capitals = new Set<string>();
  private covered = new Set<string>();

  constructor(
    private readonly map: MlMap,
    lib: MapLib,
    places: Place[],
    private readonly locale: Locale,
    private readonly m: Messages,
    onSelect: (placeId: string) => void,
  ) {
    for (const place of places) {
      const host = document.createElement("div");
      const el = document.createElement("button");
      host.appendChild(el);
      el.type = "button";
      el.className = "landmark";
      el.dataset.visible = "false";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect(place.id);
      });
      const marker = new lib.Marker({ element: host, anchor: "center" }).setLngLat([place.lng, place.lat]).addTo(map);
      this.entries.push({ place, marker, el });
    }
    map.on("zoom", () => this.applyVisibility());
  }

  /** Year decides names, visibility and which cities are capitals right now. */
  update(year: number, capitals: Set<string>, coveredByJourney: Set<string>) {
    this.year = year;
    this.capitals = capitals;
    this.covered = coveredByJourney;
    for (const { place, el } of this.entries) {
      const type: PlaceType = capitals.has(place.id) ? "capital" : place.type === "capital" ? "city" : place.type;
      const name = t(placeNameIn(place, year), this.locale);
      const modern = place.names.modern ? t(place.names.modern, this.locale) : "";
      if (el.dataset.type !== type || el.dataset.name !== name) {
        el.dataset.type = type;
        el.dataset.name = name;
        el.innerHTML = `${placeIconSvg(type)}<span class="lm-label"></span>${modern ? `<span class="lm-modern"></span>` : ""}`;
        el.querySelector(".lm-label")!.textContent = name;
        const mod = el.querySelector(".lm-modern");
        if (mod) mod.textContent = `${this.m.sim.modernName}: ${modern}`;
      }
      el.setAttribute("aria-label", modern ? `${name} (${this.m.sim.modernName}: ${modern})` : name);
    }
    this.applyVisibility();
  }

  private applyVisibility() {
    const z = this.map.getZoom();
    for (const { place, el } of this.entries) {
      const capital = this.capitals.has(place.id);
      const visible =
        isPlaceVisibleIn(place, this.year) && (capital || z >= MIN_ZOOM[place.importance]) && !this.covered.has(place.id);
      el.dataset.visible = String(visible);
      el.tabIndex = visible ? 0 : -1;
    }
  }

  visibleEntries(): LandmarkEntry[] {
    return this.entries.filter((e) => e.el.dataset.visible === "true");
  }

  isCapital(id: string) {
    return this.capitals.has(id);
  }
}
