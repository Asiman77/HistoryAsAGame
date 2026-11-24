import type { Map as MlMap, Marker } from "maplibre-gl";
import { placeIconSvg } from "@/features/map/icons";
import type { LngLat, ShellLandmark, ShellPlace } from "@/features/simulation-shell/types";

type MapLib = typeof import("maplibre-gl");

/** Minimum zoom per importance (§7): from afar only capitals and major cities. */
const MIN_ZOOM: Record<1 | 2 | 3, number> = { 1: 0, 2: 4.7, 3: 5.9 };
/** A landmark this close to a place of the story is drawn by the story marker instead. */
const SAME_KM = 3;

/**
 * MapLibre writes an inline opacity on a marker element, so our classes go on
 * an inner element and the marker gets a plain host around it.
 */
function hosted(inner: HTMLElement): HTMLElement {
  const host = document.createElement("div");
  host.appendChild(inner);
  return host;
}

const close = (a: LngLat, b: LngLat) => Math.abs(a[0] - b[0]) * 85 < SAME_KM && Math.abs(a[1] - b[1]) * 111 < SAME_KM;

/**
 * HTML markers of the simulation map: catalogue places (miniature icons,
 * period name, modern name on hover, visibility by importance and zoom),
 * the places the story has reached, the current place with a pulse, and the
 * rider that moves along a route being drawn.
 */
export class ShellMarkers {
  private landmarks: { item: ShellLandmark; marker: Marker; el: HTMLElement; label: HTMLElement }[] = [];
  private places: { item: ShellPlace; marker: Marker; el: HTMLElement }[] = [];
  private current: Marker;
  private currentLabel: HTMLElement;
  readonly rider: Marker;
  private year = 0;
  private capitals = new Set<string>();
  /** Catalogue place of the current step, for a click on the current marker. */
  private currentPlaceId: string | null = null;

  constructor(
    private readonly map: MlMap,
    lib: MapLib,
    landmarks: ShellLandmark[],
    places: ShellPlace[],
    /** City card (Q6). Keyboard users open it from the place name in the panel. */
    onPlace: (placeId: string) => void,
  ) {
    const clickable = (el: HTMLElement, id: () => string | null) => {
      el.addEventListener("click", (e) => {
        const placeId = id();
        if (!placeId) return;
        e.stopPropagation();
        onPlace(placeId);
      });
    };
    for (const item of landmarks) {
      if (places.some((p) => close(p.center, item.center))) continue;
      const el = document.createElement("div");
      el.className = "gl-landmark";
      el.dataset.visible = "false";
      const icon = document.createElement("span");
      icon.className = "gl-landmark-icon";
      const label = document.createElement("span");
      label.className = "gl-label";
      el.append(icon, label);
      el.dataset.clickable = "true";
      clickable(el, () => item.id);
      const marker = new lib.Marker({ element: hosted(el), anchor: "center" }).setLngLat(item.center).addTo(map);
      this.landmarks.push({ item, marker, el, label });
    }
    for (const item of places) {
      const el = document.createElement("div");
      el.className = "gl-place";
      el.dataset.visible = "false";
      el.innerHTML = `<span class="gl-dot"></span><span class="gl-label"></span>`;
      el.querySelector(".gl-label")!.textContent = item.name;
      if (item.placeId) {
        el.dataset.clickable = "true";
        clickable(el, () => item.placeId);
      }
      const marker = new lib.Marker({ element: hosted(el), anchor: "left", offset: [-5, 0] }).setLngLat(item.center).addTo(map);
      this.places.push({ item, marker, el });
    }
    const cur = document.createElement("div");
    cur.className = "gl-current";
    cur.setAttribute("data-testid", "map-current");
    cur.innerHTML = `<span class="gl-pulse"></span><span class="gl-core"></span><span class="gl-current-label"></span>`;
    this.currentLabel = cur.querySelector(".gl-current-label")!;
    clickable(cur, () => this.currentPlaceId);
    this.current = new lib.Marker({ element: hosted(cur), anchor: "center" }).setLngLat([0, 0]);
    const rider = document.createElement("div");
    rider.className = "gl-rider";
    this.rider = new lib.Marker({ element: hosted(rider), anchor: "center" }).setLngLat([0, 0]);
    map.on("zoom", () => this.applyVisibility());
  }

  /** Places reached by step `index`, the current marker, and landmark names and icons for the step year. */
  update(index: number, year: number, center: LngLat, placeName: string, capitals: string[], placeId: string | null = null) {
    this.year = year;
    this.currentPlaceId = placeId;
    (this.current.getElement().firstElementChild as HTMLElement).dataset.clickable = String(!!placeId);
    this.capitals = new Set(capitals);
    for (const { item, el } of this.places) {
      const here = close(item.center, center);
      el.dataset.visible = String(item.firstStep <= index && !here);
    }
    this.currentLabel.textContent = placeName.replace(/\s*\(.*\)\s*$/, "");
    this.current.setLngLat(center).addTo(this.map);
    for (const { item, el, label } of this.landmarks) {
      const period = item.periods.find((p) => year >= p.from && year <= p.to);
      const type = this.capitals.has(item.id) ? "capital" : item.type === "capital" ? "city" : item.type;
      if (el.dataset.type !== type) {
        el.dataset.type = type;
        el.querySelector(".gl-landmark-icon")!.innerHTML = placeIconSvg(type, 20);
      }
      label.textContent = period?.name ?? "";
      el.title = item.modern && item.modern !== period?.name ? item.modern : "";
      el.dataset.period = String(!!period);
    }
    this.applyVisibility();
  }

  private applyVisibility() {
    const zoom = this.map.getZoom();
    for (const { item, el } of this.landmarks) {
      const capital = this.capitals.has(item.id);
      const visible = el.dataset.period === "true" && (capital || zoom >= MIN_ZOOM[item.importance]);
      el.dataset.visible = String(visible);
    }
  }

  showRider(at: LngLat | null) {
    if (at) this.rider.setLngLat(at).addTo(this.map);
    else this.rider.remove();
  }

  /** For tests and the fallback check. */
  get shownYear() {
    return this.year;
  }
}
