import type { StyleSpecification } from "maplibre-gl";

/**
 * A deliberately sparse base map: parchment ground, desaturated shaded relief,
 * hillshade from elevation tiles, water and rivers only. No modern borders,
 * roads or place names: historical names are drawn by the app itself.
 */
export function buildBaseStyle({ hillshade }: { hillshade: boolean }): StyleSpecification {
  return {
    version: 8,
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
      { id: "ground", type: "background", paint: { "background-color": "#e4dac3" } },
      {
        id: "relief",
        type: "raster",
        source: "relief",
        paint: {
          "raster-opacity": 0.62,
          "raster-saturation": -0.8,
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
          "hillshade-shadow-color": "#5a4630",
          "hillshade-highlight-color": "#fff6e0",
          "hillshade-accent-color": "#8a7457",
          "hillshade-illumination-direction": 315,
        },
      },
      {
        id: "water",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        paint: { "fill-color": "#b3c2b4", "fill-opacity": 0.95 },
      },
      {
        id: "water-edge",
        type: "line",
        source: "omt",
        "source-layer": "water",
        paint: { "line-color": "#6e877c", "line-width": 0.7, "line-opacity": 0.55 },
      },
      {
        id: "rivers",
        type: "line",
        source: "omt",
        "source-layer": "waterway",
        filter: ["==", ["get", "class"], "river"],
        minzoom: 4,
        paint: {
          "line-color": "#7d978b",
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
