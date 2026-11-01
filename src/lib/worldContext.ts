import type { WorldEvent } from "@/domain/schema";

const WINDOW_YEARS = 12;

/** Years between `year` and the event's span (0 when the year falls inside it). */
function gap(e: WorldEvent, year: number): number {
  const end = e.endYear ?? e.year;
  if (year < e.year) return e.year - year;
  if (year > end) return year - end;
  return 0;
}

/**
 * "Meanwhile in the world": up to `limit` events closest to the year, within
 * ±12 years, preferring different regions so the panel is not all Europe.
 */
export function pickWorldEvents(year: number, events: readonly WorldEvent[], limit = 3): WorldEvent[] {
  const near = events
    .filter((e) => gap(e, year) <= WINDOW_YEARS)
    .sort((a, b) => gap(a, year) - gap(b, year) || a.year - b.year || a.id.localeCompare(b.id));
  const picked: WorldEvent[] = [];
  const regions = new Set<string>();
  for (const e of near) {
    if (picked.length >= limit) break;
    if (!regions.has(e.region)) {
      picked.push(e);
      regions.add(e.region);
    }
  }
  for (const e of near) {
    if (picked.length >= limit) break;
    if (!picked.includes(e)) picked.push(e);
  }
  return picked.sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
}

export function yearDelta(e: WorldEvent, year: number): number {
  return gap(e, year) === 0 ? 0 : e.year - year;
}
