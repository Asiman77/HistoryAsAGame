import type { Location, LocalizedText, Place } from "@/domain/schema";

/** Event locations closer than this to a catalogue place are treated as that place. */
const MATCH_KM = 30;

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Catalogue place for an event location: the explicit `placeId`, else the nearest one within 30 km. */
export function matchPlace(location: Location, places: readonly Place[]): Place | null {
  if (location.placeId) return places.find((p) => p.id === location.placeId) ?? null;
  let best: Place | null = null;
  let bestKm = MATCH_KM;
  for (const p of places) {
    const km = distanceKm(location, p);
    if (km < bestKm) {
      best = p;
      bestKm = km;
    }
  }
  return best;
}

export function isPlaceVisibleIn(place: Place, year: number): boolean {
  return place.periods.some((p) => year >= p.from && year <= p.to);
}

/** Name used in that year (e.g. Konstantinopol before 1453, İstanbul after). */
export function placeNameIn(place: Place, year: number): LocalizedText {
  return place.periods.find((p) => year >= p.from && year <= p.to)?.name ?? place.names.historical;
}

/** Places whose periods overlap the given span. */
export function placesForSpan(places: readonly Place[], from: number, to: number): Place[] {
  return places.filter((p) => p.periods.some((r) => r.from <= to && r.to >= from));
}
