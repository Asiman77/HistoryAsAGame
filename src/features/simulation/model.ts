import type { Era, LifeEvent, Person, Place, QuizQuestion } from "@/domain/schema";
import { ageAt, type Age } from "@/lib/dates";
import { buildRoute, routeDistanceKm, type LngLat } from "@/lib/geo";

/** Everything the client needs for one step, precomputed at build time. */
export interface Step {
  event: LifeEvent;
  age: Age;
  /** Smoothed path for movement events; null when the person stays put. */
  route: LngLat[] | null;
  distanceKm: number;
}

export interface MapPlace {
  key: string;
  place: Place;
  /** Index of the first step that reveals this place. */
  firstStep: number;
  /** Steps that happen here. */
  steps: number[];
}

export interface JourneyStats {
  distanceKm: number;
  victories: number;
  defeats: number;
  battles: number;
  placeCount: number;
  choiceCount: number;
}

export interface Journey {
  person: Person;
  eras: Era[];
  steps: Step[];
  places: MapPlace[];
  stats: JourneyStats;
  quiz: QuizQuestion[];
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;
const placeKey = (p: Place) => `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;

export function buildJourney(person: Person, events: LifeEvent[], allEras: Era[]): Journey {
  const steps: Step[] = events.map((event) => ({
    event,
    age: ageAt(person.birth.date, event.date),
    route:
      buildRoute(event)?.geometry.coordinates.map(([lng, lat]) => [round(lng!), round(lat!)] as LngLat) ?? null,
    distanceKm: Math.round(routeDistanceKm(event)),
  }));

  const places = new Map<string, MapPlace>();
  steps.forEach(({ event }, i) => {
    const key = placeKey(event.location);
    const existing = places.get(key);
    if (existing) existing.steps.push(i);
    else places.set(key, { key, place: event.location, firstStep: i, steps: [i] });
  });

  const battles = events.filter((e) => e.type === "battle");
  const stats: JourneyStats = {
    distanceKm: steps.reduce((sum, s) => sum + s.distanceKm, 0),
    battles: battles.length,
    victories: battles.filter((e) => e.outcome?.result === "victory").length,
    defeats: battles.filter((e) => e.outcome?.result === "defeat").length,
    placeCount: places.size,
    choiceCount: events.filter((e) => e.choice).length,
  };

  return {
    person,
    eras: allEras.filter((e) => person.eraIds.includes(e.id)),
    steps,
    places: [...places.values()],
    stats,
    quiz: events.flatMap((e) => e.quiz ?? []),
  };
}
