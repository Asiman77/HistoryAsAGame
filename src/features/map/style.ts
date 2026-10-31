import type { StyleSpecification } from "maplibre-gl";

/**
 * A deliberately sparse base map: parchment ground, desaturated shaded relief
 * and water only. No modern borders, roads or place names: historical names
 * are drawn by the app itself from event data.
 */
export function buildBaseStyle(): StyleSpecification {
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
