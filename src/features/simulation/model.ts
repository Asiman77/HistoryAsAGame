import type {
  Era,
  GlossaryEntry,
  ImageAsset,
  LifeEvent,
  Location,
  LocalizedText,
  Mood,
  Person,
  Place,
  QuizQuestion,
  Relation,
  TerritorySnapshotMeta,
  WorldEvent,
} from "@/domain/schema";
import { ageAt, type Age } from "@/lib/dates";
import { buildRoute, routeDistanceKm, type LngLat } from "@/lib/geo";
import { matchPlace, placesForSpan } from "@/lib/places";
import { pickSnapshotId } from "@/lib/territory";
import { pickWorldEvents } from "@/lib/worldContext";

/** A link from this step into another person's story. */
export interface StepMoment {
  note: LocalizedText;
  person: { id: string; name: LocalizedText; portrait?: ImageAsset };
  targetEventId: string;
  targetTitle: LocalizedText;
  targetYear: number;
}

/** Everything the client needs for one step, precomputed at build time. */
export interface Step {
  event: LifeEvent;
  age: Age;
  mood: Mood;
  /** Smoothed path for movement events; null when the person stays put. */
  route: LngLat[] | null;
  distanceKm: number;
  snapshotId: string | null;
  /** Catalogue place the event happens at, if any. */
  placeId: string | null;
  moments: StepMoment[];
  world: WorldEvent[];
}

export interface MapPlace {
  key: string;
  place: Location;
  /** Index of the first step that reveals this place. */
  firstStep: number;
  /** Steps that happen here. */
  steps: number[];
  placeId: string | null;
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
  /** Catalogue places relevant to this lifetime. */
  landmarks: Place[];
  snapshots: TerritorySnapshotMeta[];
  polityColors: Record<string, string>;
  glossary: GlossaryEntry[];
}

export interface JourneyContext {
  places: Place[];
  snapshots: TerritorySnapshotMeta[];
  polityColors: Record<string, string>;
  worldEvents: WorldEvent[];
  glossary: GlossaryEntry[];
  relations: Relation[];
  /** Other persons referenced by relations, with their events. */
  others: { person: Person; events: LifeEvent[] }[];
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;
const placeKey = (p: Location) => `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;

export function buildJourney(person: Person, events: LifeEvent[], allEras: Era[], ctx?: JourneyContext): Journey {
  const landmarks = ctx ? placesForSpan(ctx.places, person.birth.date.year, person.death.date.year) : [];
  const others = new Map((ctx?.others ?? []).map((o) => [o.person.id, o]));

  const momentsFor = (eventId: string): StepMoment[] =>
    (ctx?.relations ?? []).flatMap((r) =>
      (r.moments ?? [])
        .filter((m) => m.personId === person.id && m.eventId === eventId)
        .flatMap((m) => {
          const otherId = r.from === person.id ? r.to : r.from;
          const other = others.get(otherId);
          if (!other) return [];
          const target = other.events.find((e) => e.id === m.targetEventId) ?? other.events[0];
          if (!target) return [];
          return [
            {
              note: m.note,
              person: {
                id: other.person.id,
                name: other.person.shortName ?? other.person.name,
                ...(other.person.portrait ? { portrait: other.person.portrait } : {}),
              },
              targetEventId: target.id,
              targetTitle: target.title,
              targetYear: target.date.year,
            },
          ];
        }),
    );

  const steps: Step[] = events.map((event) => ({
    event,
    age: ageAt(person.birth.date, event.date),
    mood: event.mood,
    route:
      buildRoute(event)?.geometry.coordinates.map(([lng, lat]) => [round(lng!), round(lat!)] as LngLat) ?? null,
    distanceKm: Math.round(routeDistanceKm(event)),
    snapshotId: ctx ? pickSnapshotId(event.date.year, ctx.snapshots, event.territorySnapshotId) : null,
    placeId: matchPlace(event.location, landmarks)?.id ?? null,
    moments: momentsFor(event.id),
    world: ctx ? pickWorldEvents(event.date.year, ctx.worldEvents) : [],
  }));

  const places = new Map<string, MapPlace>();
  steps.forEach(({ event, placeId }, i) => {
    const key = placeKey(event.location);
    const existing = places.get(key);
    if (existing) existing.steps.push(i);
    else places.set(key, { key, place: event.location, firstStep: i, steps: [i], placeId });
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
    landmarks,
    snapshots: ctx?.snapshots ?? [],
    polityColors: ctx?.polityColors ?? {},
    glossary: ctx?.glossary ?? [],
  };
}
