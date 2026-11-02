import type {
  Era,
  EventType,
  GlossaryEntry,
  LifeEvent,
  Location,
  Person,
  Place,
  QuizQuestion,
  TerritorySnapshotMeta,
  WorldEvent,
} from "@/domain/schema";
import { resolveRef, type Registry } from "@/domain/registry";
import type { EngineStep, MapPlace, PoliticalContext, SimulationData } from "@/features/engine/types";
import { ageAt, type Age } from "@/lib/dates";
import { buildRoute, routeDistanceKm, type LngLat } from "@/lib/geo";
import { matchPlace, placesForSpan } from "@/lib/places";
import { pickSnapshotId } from "@/lib/territory";
import { pickWorldEvents } from "@/lib/worldContext";
import { eraViews, pickThemeId, pickThemes, type ThemeMap } from "@/lib/theme";

export type { MapPlace } from "@/features/engine/types";

/** A life event as a simulation step. */
export interface Step extends EngineStep {
  event: LifeEvent;
  age: Age;
  world: WorldEvent[];
}

export interface JourneyStats {
  distanceKm: number;
  victories: number;
  defeats: number;
  battles: number;
  placeCount: number;
  choiceCount: number;
}

export interface Journey extends SimulationData<Step> {
  person: Person;
  stats: JourneyStats;
  quiz: QuizQuestion[];
}

export interface JourneyContext {
  places: Place[];
  snapshots: TerritorySnapshotMeta[];
  polityColors: Record<string, string>;
  worldEvents: WorldEvent[];
  glossary: GlossaryEntry[];
  registry: Registry;
  political: PoliticalContext;
  themes: ThemeMap;
}

const ZOOM_BY_TYPE: Partial<Record<EventType, number>> = {
  battle: 6.6,
  birth: 6.2,
  death: 6.2,
  childhood: 6.4,
  education: 6.4,
  coronation: 6.2,
};
const DEFAULT_ZOOM = 5.8;

const round = (n: number) => Math.round(n * 1e4) / 1e4;
const placeKey = (p: Location) => `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;

export function buildJourney(person: Person, events: LifeEvent[], allEras: Era[], ctx?: JourneyContext): Journey {
  const personEras = allEras.filter((e) => person.eraIds.includes(e.id));
  const themeOf = (year: number, stepThemeId?: string) =>
    pickThemeId({ stepThemeId, entityThemeId: person.themeId, year, entityEras: personEras, allEras });
  const landmarks = ctx ? placesForSpan(ctx.places, person.birth.date.year, person.death.date.year) : [];

  const steps: Step[] = events.map((event) => ({
    id: event.id,
    year: event.date.year,
    title: event.title,
    timelineLabel: String(event.date.year),
    icon: event.type,
    mood: event.mood,
    location: event.location,
    zoom: ZOOM_BY_TYPE[event.type] ?? DEFAULT_ZOOM,
    route:
      buildRoute(event)?.geometry.coordinates.map(([lng, lat]) => [round(lng!), round(lat!)] as LngLat) ?? null,
    distanceKm: Math.round(routeDistanceKm(event)),
    snapshotId: ctx ? pickSnapshotId(event.date.year, ctx.snapshots, event.territorySnapshotId) : null,
    placeId: matchPlace(event.location, landmarks)?.id ?? null,
    battle: event.outcome ?? null,
    related: ctx ? (event.related ?? []).map((r) => resolveRef(r, ctx.registry)) : [],
    themeId: themeOf(event.date.year, event.themeId),
    event,
    age: ageAt(person.birth.date, event.date),
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

  const y = (d: Person["birth"]["date"]) => (d.certainty === "exact" ? String(d.year) : `~${d.year}`);
  return {
    key: person.id,
    path: `/persons/${person.id}/`,
    title: person.name,
    subtitle: `${y(person.birth.date)} – ${y(person.death.date)}`,
    ...(person.portrait ? { image: person.portrait } : {}),
    person,
    eras: eraViews(personEras, ctx?.themes ?? {}),
    themeId: themeOf(events.at(-1)?.date.year ?? person.death.date.year),
    themes: pickThemes(ctx?.themes ?? {}, [...steps.map((s) => s.themeId), themeOf(events.at(-1)?.date.year ?? person.death.date.year)]),
    steps,
    places: [...places.values()],
    stats,
    quiz: events.flatMap((e) => e.quiz ?? []),
    landmarks,
    snapshots: ctx?.snapshots ?? [],
    polityColors: ctx?.polityColors ?? {},
    glossary: ctx?.glossary ?? [],
    political: ctx?.political ?? { polities: [], rulers: [], reigns: [] },
  };
}
