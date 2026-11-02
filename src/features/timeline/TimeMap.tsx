"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import type { Locale, Place, TerritorySnapshotMeta } from "@/domain/schema";
import { withBasePath } from "@/lib/basePath";
import { t } from "@/lib/i18n";
import type { PersonAtYear } from "@/lib/timeSlider";
import { applyMapVariant, buildBaseStyle, type MapStyleVariant } from "@/features/map/style";
import { TerritoryLayers } from "@/features/map/territories";

const WORKER_URL = withBasePath("/vendor/maplibre-gl-worker.mjs");

interface Props {
  snapshot: TerritorySnapshotMeta | null;
  /** The map is borrowed from another period: drawn faded. */
  faded: boolean;
  persons: PersonAtYear[];
  landmarks: Place[];
  variant: MapStyleVariant;
  light: boolean;
  locale: Locale;
  label: string;
  onSelectPolity: (id: string) => void;
}

/**
 * Political map of the time slider: borders crossfade between snapshots
 * (reusing the simulation's territory layers), capitals are starred and the
 * persons alive that year stand where their story had them.
 */
export function TimeMap({ snapshot, faded, persons, landmarks, variant, light, locale, label, onSelectPolity }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const layersRef = useRef<TerritoryLayers | null>(null);
  const capitalMarkers = useRef<Marker[]>([]);
  const personMarkers = useRef<Map<string, { marker: Marker; el: HTMLElement }>>(new Map());
  const selectRef = useRef(onSelectPolity);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);

  useEffect(() => {
    selectRef.current = onSelectPolity;
  }, [onSelectPolity]);

  useEffect(() => {
    let disposed = false;
    const people = personMarkers.current;
    (async () => {
      const lib = await import("maplibre-gl");
      lib.setWorkerUrl(WORKER_URL);
      if (disposed || !box.current) return;
      libRef.current = lib;
      const map = new lib.Map({
        container: box.current,
        style: buildBaseStyle({ hillshade: false, variant: "manuscript" }),
        center: [50, 37],
        zoom: 3.6,
        minZoom: 2.5,
        maxZoom: 7,
        dragRotate: false,
        renderWorldCopies: false,
        attributionControl: false,
        fadeDuration: 0,
        pixelRatio: 1,
      });
      map.touchZoomRotate.disableRotation();
      mapRef.current = map;
      map.on("load", () => {
        if (disposed) return;
        // Empty anchor layer: territories are drawn below it, markers above.
        map.addSource("anchor", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "anchor", type: "line", source: "anchor" });
        const layers = new TerritoryLayers(map, lib, locale, "anchor");
        layers.enableInteraction(setHover, (id) => selectRef.current(id));
        layersRef.current = layers;
        setReady(true);
      });
    })();
    return () => {
      disposed = true;
      people.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [locale]);

  useEffect(() => {
    if (ready && mapRef.current) applyMapVariant(mapRef.current, variant);
  }, [ready, variant]);

  useEffect(() => {
    layersRef.current?.setInstant(light);
  }, [ready, light]);

  // Borders: only when the snapshot really changes (dragging through years inside one map costs nothing).
  const snapshotId = snapshot?.id ?? null;
  useEffect(() => {
    if (!ready) return;
    void layersRef.current?.show(snapshotId);
  }, [ready, snapshotId]);

  // Capitals of the shown snapshot.
  const capitalsKey = JSON.stringify(snapshot?.polities.map((p) => p.capitalId).filter(Boolean) ?? []);
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    for (const m of capitalMarkers.current) m.remove();
    const ids = JSON.parse(capitalsKey) as string[];
    capitalMarkers.current = ids.flatMap((id) => {
      const p = landmarks.find((x) => x.id === id);
      if (!p) return [];
      const el = document.createElement("div");
      el.className = "capital-star";
      el.title = t(p.names.historical, locale);
      el.innerHTML = `<span aria-hidden>★</span><b>${t(p.names.historical, locale)}</b>`;
      return [new lib.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(map)];
    });
  }, [ready, capitalsKey, landmarks, locale]);

  // Persons alive this year: portrait medallions that walk with their story.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    const live = personMarkers.current;
    const seen = new Set<string>();
    for (const p of persons) {
      seen.add(p.person.id);
      const text = `${t(p.person.name, locale)} · ${p.approximate ? "~" : ""}${p.age}`;
      const existing = live.get(p.person.id);
      if (existing) {
        existing.marker.setLngLat([p.lng, p.lat]);
        existing.el.querySelector("b")!.textContent = text;
        continue;
      }
      const el = document.createElement("a");
      el.className = "person-pin";
      el.href = withBasePath(`/${locale}${p.person.href}`);
      el.dataset.testid = "person-pin";
      if (p.person.image) {
        const img = document.createElement("img");
        img.src = withBasePath(p.person.image.src);
        img.alt = "";
        el.appendChild(img);
      }
      const b = document.createElement("b");
      b.textContent = text;
      el.appendChild(b);
      live.set(p.person.id, { el, marker: new lib.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(map) });
    }
    for (const [id, m] of live)
      if (!seen.has(id)) {
        m.marker.remove();
        live.delete(id);
      }
  }, [ready, persons, locale]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-ink/15 bg-parchment-dark" role="region" aria-label={label}>
      <div ref={box} className={`h-full w-full transition-opacity duration-700 ${faded ? "opacity-35 grayscale" : ""}`} />
      {hover && (
        <span className="pointer-events-none absolute z-10 rounded bg-ink/85 px-2 py-0.5 font-display text-sm text-parchment-light" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          {hover.name}
        </span>
      )}
    </div>
  );
}
