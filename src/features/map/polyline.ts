import type { LngLat } from "@/lib/geo";

/** Cumulative along-line distances, using a local equirectangular metric (good enough for animation pacing). */
export function cumulativeLengths(coords: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) {
    const [x1, y1] = coords[i - 1]!;
    const [x2, y2] = coords[i]!;
    const k = Math.cos((((y1 + y2) / 2) * Math.PI) / 180);
    out.push(out[i - 1]! + Math.hypot((x2 - x1) * k, y2 - y1));
  }
  return out;
}

/** Returns the part of the line up to fraction `t` (0..1) and the head position. */
export function sliceAlong(coords: LngLat[], cum: number[], t: number): { partial: LngLat[]; head: LngLat } {
  const total = cum.at(-1) ?? 0;
  if (coords.length < 2 || total === 0) return { partial: coords.slice(), head: coords.at(-1) ?? [0, 0] };
  const target = Math.min(Math.max(t, 0), 1) * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i]! < target) i++;
  const a = coords[i - 1]!;
  const b = coords[i]!;
  const seg = cum[i]! - cum[i - 1]!;
  const f = seg === 0 ? 0 : (target - cum[i - 1]!) / seg;
  const head: LngLat = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  return { partial: [...coords.slice(0, i), head], head };
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

export function boundsOf(coords: LngLat[]): [LngLat, LngLat] {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of coords) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}
