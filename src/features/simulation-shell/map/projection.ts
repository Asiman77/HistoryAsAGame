import type { LngLat } from "../types";

/*
 * Projection of the schematic SVG map: equirectangular, stretched at the
 * latitude of the region (38° N) so shapes look right around Azerbaijan.
 * Map units: x = lng · cos 38°, y = −lat (degrees of latitude).
 */
export const LNG_SCALE = Math.cos((38 * Math.PI) / 180);

export const project = ([lng, lat]: LngLat): [number, number] => [lng * LNG_SCALE, -lat];

/** Width of the view in map units at a MapLibre-like zoom for a viewport `px` wide (512 px tiles). */
export const spanAtZoom = (zoom: number, px: number) => ((px / 512) * 360 * LNG_SCALE) / 2 ** zoom;

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/** SVG path of a line, in map units. */
export function linePath(coords: LngLat[]): string {
  return coords.map((c, i) => `${i ? "L" : "M"}${project(c).map(fmt).join(",")}`).join("");
}

type Ring = number[][];

/** SVG path of a Polygon / MultiPolygon (land outline), in map units, 0.01° precision. */
export function polygonPath(geometry: { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] }): string {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons
    .flatMap((rings) =>
      rings.map((ring) => {
        const pts = ring.map(([lng, lat]) => project([lng!, lat!]).map(fmt).join(","));
        return `M${pts.join("L")}Z`;
      }),
    )
    .join("");
}
