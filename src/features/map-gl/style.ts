import type { Map as MlMap, StyleSpecification } from "maplibre-gl";
import type { MapVariant } from "@/features/simulation-shell/types";
import { MAP_PALETTES } from "@/theme/mapPalettes";

/** Our own base style (§7): parchment ground, relief, water and rivers; no modern borders, roads or names. */
export function buildShellStyle({ variant, hillshade }: { variant: MapVariant; hillshade: boolean }): StyleSpecification {
  const v = MAP_PALETTES[variant];
  return {
    version: 8,
    transition: { duration: 750, delay: 0 },
    sources: {
      relief: {
        type: "raster",
        tiles: ["https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 6,
        attribution: "Natural Earth",
      },
      dem: {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 9,
        attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Terrain Tiles</a>',
      },
      omt: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution:
          '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      },
    },
    layers: [
      { id: "ground", type: "background", paint: { "background-color": v.ground } },
      {
        id: "relief",
        type: "raster",
        source: "relief",
        paint: {
          "raster-opacity": v.reliefOpacity,
          "raster-saturation": v.reliefSaturation,
          "raster-contrast": -0.15,
          "raster-brightness-min": 0.3,
          "raster-brightness-max": 0.98,
          "raster-fade-duration": 0,
        },
      },
      {
        id: "hillshade",
        type: "hillshade",
        source: "dem",
        layout: { visibility: hillshade ? "visible" : "none" },
        paint: {
          "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 3, 0.45, 8, 0.3],
          "hillshade-shadow-color": v.shadow,
          "hillshade-highlight-color": v.highlight,
          "hillshade-accent-color": v.accent,
          "hillshade-illumination-direction": 315,
        },
      },
      { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": v.water, "fill-opacity": 0.95 } },
      { id: "water-edge", type: "line", source: "omt", "source-layer": "water", paint: { "line-color": v.waterEdge, "line-width": 0.7, "line-opacity": 0.55 } },
      {
        id: "rivers",
        type: "line",
        source: "omt",
        "source-layer": "waterway",
        filter: ["==", ["get", "class"], "river"],
        minzoom: 4,
        paint: { "line-color": v.river, "line-opacity": 0.8, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 9, 1.8] },
      },
    ],
  };
}

/** Switches the base map of a live map to another period; MapLibre fades the paint changes. */
export function applyVariant(map: MlMap, variant: MapVariant) {
  const v = MAP_PALETTES[variant];
  const set = (layer: string, prop: string, value: unknown) => map.getLayer(layer) && map.setPaintProperty(layer, prop as never, value as never);
  set("ground", "background-color", v.ground);
  set("relief", "raster-opacity", v.reliefOpacity);
  set("relief", "raster-saturation", v.reliefSaturation);
  set("water", "fill-color", v.water);
  set("water-edge", "line-color", v.waterEdge);
  set("rivers", "line-color", v.river);
  set("hillshade", "hillshade-shadow-color", v.shadow);
  set("hillshade", "hillshade-highlight-color", v.highlight);
  set("hillshade", "hillshade-accent-color", v.accent);
}
