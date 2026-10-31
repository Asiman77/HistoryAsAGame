import { bezierSpline, greatCircle, length, lineString, point } from "@turf/turf";
import type { Feature, LineString } from "geojson";
import type { LifeEvent, Place } from "@/domain/schema";

export type LngLat = [number, number];

const toLngLat = (p: Place): LngLat => [p.lng, p.lat];

/** Offsets the midpoint sideways to get a gentle arc for short, waypoint-less hops. */
function arcThrough(a: LngLat, b: LngLat): LngLat[] {
  const mid: LngLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const bend = 0.18;
  return [a, [mid[0] - dy * bend, mid[1] + dx * bend], b];
}

/**
 * Smooth path for a movement event: through the given waypoints if any,
 * otherwise a slight arc. Returns null when the event is not a movement.
 */
export function buildRoute(event: Pick<LifeEvent, "fromLocation" | "location" | "route">): Feature<LineString> | null {
  if (!event.fromLocation) return null;
  const from = toLngLat(event.fromLocation);
  const to = toLngLat(event.location);
  if (from[0] === to[0] && from[1] === to[1]) return null;

  const waypoints = event.route ?? [];
  if (waypoints.length === 0 && length(lineString([from, to])) > 1500) {
    return greatCircle(point(from), point(to), { npoints: 96 }) as Feature<LineString>;
  }
  const controls = waypoints.length > 0 ? [from, ...waypoints, to] : arcThrough(from, to);
  return bezierSpline(lineString(controls), { resolution: 2500, sharpness: 0.85 });
}

/** Approximate distance in km (straight segments between waypoints, not the drawn curve). */
export function routeDistanceKm(event: Pick<LifeEvent, "fromLocation" | "location" | "route">): number {
  if (!event.fromLocation) return 0;
  const pts = [toLngLat(event.fromLocation), ...(event.route ?? []), toLngLat(event.location)];
  return length(lineString(pts), { units: "kilometers" });
}
