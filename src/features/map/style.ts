import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { MAP_STYLE_VARIANTS } from "@/domain/schema";

export type MapStyleVariant = (typeof MAP_STYLE_VARIANTS)[number];

interface VariantPaint {
  ground: string;
  reliefOpacity: number;
  reliefSaturation: number;
  water: string;
  waterEdge: string;
  river: string;
  shadow: string;
  highlight: string;
  accent: string;
}

/**
 * Base-map colours per period theme (data/themes: mapStyleVariant).
 * manuscript: the default parchment; miniature: warmer gold ground and
 * lapis-green water, as on Tabriz/Safavid maps; military: drier, darker
 * campaign map; modern: neutral grey-blue for 2020.
 */
export const MAP_VARIANTS: Record<MapStyleVariant, VariantPaint> = {
  manuscript: { ground: "#e4dac3", reliefOpacity: 0.62, reliefSaturation: -0.8, water: "#b3c2b4", waterEdge: "#6e877c", river: "#7d978b", shadow: "#5a4630", highlight: "#fff6e0", accent: "#8a7457" },
  miniature: { ground: "#e8d9b5", reliefOpacity: 0.55, reliefSaturation: -0.7, water: "#9fbcb6", waterEdge: "#4f7f7a", river: "#5f8f88", shadow: "#5b4426", highlight: "#fff3d6", accent: "#8f7448" },
  military: { ground: "#ddd2bd", reliefOpacity: 0.7, reliefSaturation: -0.9, water: "#aab6b0", waterEdge: "#5f6f69", river: "#76857e", shadow: "#4a3a2a", highlight: "#f6ecd8", accent: "#7a6650" },
  modern: { ground: "#e9edf0", reliefOpacity: 0.5, reliefSaturation: -1, water: "#b9d3e3", waterEdge: "#6f9ab5", river: "#7fa8c2", shadow: "#3d4a57", highlight: "#ffffff", accent: "#7d8a96" },
};

/** Switch the base map of a live map; MapLibre fades paint changes. */
export function applyMapVariant(map: MapLibreMap, variant: MapStyleVariant) {
  const v = MAP_VARIANTS[variant];
  const set = (layer: string, prop: string, value: unknown) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop as never, value as never);
  };
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

/**
 * A deliberately sparse base map: parchment ground, desaturated shaded relief,
 * hillshade from elevation tiles, water and rivers only. No modern borders,
 * roads or place names: historical names are drawn by the app itself.
 */
export function buildBaseStyle({ hillshade, variant = "manuscript" }: { hillshade: boolean; variant?: MapStyleVariant }): StyleSpecification {
  const v = MAP_VARIANTS[variant];
  return {
    version: 8,
    transition: { duration: 1200, delay: 0 },
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
        attribution:
          '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Terrain Tiles</a> (Mapzen, AWS Open Data)',
      },
      omt: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution:
          '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
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
      {
        id: "water",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        paint: { "fill-color": v.water, "fill-opacity": 0.95 },
      },
      {
        id: "water-edge",
        type: "line",
        source: "omt",
        "source-layer": "water",
        paint: { "line-color": v.waterEdge, "line-width": 0.7, "line-opacity": 0.55 },
      },
      {
        id: "rivers",
        type: "line",
        source: "omt",
        "source-layer": "waterway",
        filter: ["==", ["get", "class"], "river"],
        minzoom: 4,
        paint: {
          "line-color": v.river,
          "line-opacity": 0.8,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 9, 1.8],
        },
      },
    ],
  };
}

/** Colours for the app's own route layers. */
export const ROUTE_COLORS = {
  trail: "#6b5435",
  active: "#9b2c2c",
  activeCasing: "#f8f0dd",
  legacy: "#9b2c2c",
} as const;

export const DEFAULT_OWN_COLOR = "#9b2c2c";
export const DEFAULT_ENEMY_COLOR = "#2d5486";
