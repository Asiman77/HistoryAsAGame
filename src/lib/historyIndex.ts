import type {
  Certainty,
  ClaimType,
  Conflict,
  EntityRef,
  Era,
  EventType,
  ImageAsset,
  LifeEvent,
  LocalizedText,
  Mood,
  Person,
  Place,
  State,
  StateStep,
  WarDay,
} from "@/domain/schema";
import { entityPath } from "@/domain/registry";
import { WAR_DAY_ICON } from "@/features/conflicts/model";
import { STATE_ICON } from "@/features/states/model";
import { matchPlace } from "./places";
import { eraForYear, pickThemeId } from "./theme";

/**
 * Every dated step of every simulation in one flat list. Place pages, the
 * global time slider, "Tarixdə bu gün" and the compare mode all read this
 * instead of walking persons, states and wars separately.
 */
export interface IndexedEvent {
  /** `<type>:<entity>:<step>`, unique. */
  key: string;
  entityType: "person" | "state" | "conflict";
  entityId: string;
  entityTitle: LocalizedText;
  /** Category badge: a person's life, a battle/war, or a state's history. */
  category: "person" | "battle" | "state";
  stepId: string;
  title: LocalizedText;
  date: { year: number; month?: number; day?: number; certainty: Certainty };
  placeId: string | null;
  lat: number;
  lng: number;
  eraId: string | null;
  themeId: string;
  claimType: ClaimType;
  icon: EventType;
  mood: Mood;
  /** Raw cross-links of the step (compare mode looks for shared battles here). */
  related: EntityRef[];
  /** Deep link without locale, e.g. "/persons/shah-ismayil/?step=ismayil-chaldiran". */
  href: string;
  image?: ImageAsset;
}

export interface IndexSources {
  eras: Era[];
  places: Place[];
  persons: { person: Person; events: LifeEvent[] }[];
  states: { state: State; steps: StateStep[] }[];
  conflicts: { conflict: Conflict; days: WarDay[] }[];
}

const dateOf = (d: LifeEvent["date"]): IndexedEvent["date"] => ({
  year: d.year,
  ...(d.month ? { month: d.month } : {}),
  ...(d.day ? { day: d.day } : {}),
  certainty: d.certainty,
});

export function buildHistoryIndex({ eras, places, persons, states, conflicts }: IndexSources): IndexedEvent[] {
  const out: IndexedEvent[] = [];
  /**
   * War days sit close together (a front line, a district), so a 30 km radius
   * would pin "Qarabağ" overviews on Şuşa. They match a place only by an
   * explicit placeId or by the same name.
   */
  const byName = (loc: LifeEvent["location"]) =>
    loc.placeId
      ? (places.find((p) => p.id === loc.placeId) ?? null)
      : (places.find((p) => [p.names.historical.az, p.names.modern?.az].some((n) => n?.split(" (")[0] === loc.name.az)) ?? null);
  const common = (
    entityEras: string[],
    entityThemeId: string | undefined,
    step: { themeId?: string | undefined; date: LifeEvent["date"]; location: LifeEvent["location"]; claimType?: ClaimType | undefined; related?: EntityRef[] | undefined },
    strict = false,
  ) => {
    const ownEras = eras.filter((e) => entityEras.includes(e.id));
    return {
      date: dateOf(step.date),
      placeId: (strict ? byName(step.location) : matchPlace(step.location, places))?.id ?? null,
      lat: step.location.lat,
      lng: step.location.lng,
      eraId: (eraForYear(ownEras, step.date.year) ?? eraForYear(eras, step.date.year))?.id ?? null,
      themeId: pickThemeId({ stepThemeId: step.themeId, entityThemeId, year: step.date.year, entityEras: ownEras, allEras: eras }),
      claimType: step.claimType ?? "fact",
      related: step.related ?? [],
    };
  };

  for (const { person, events } of persons)
    for (const e of events)
      out.push({
        key: `person:${person.id}:${e.id}`,
        entityType: "person",
        entityId: person.id,
        entityTitle: person.shortName ?? person.name,
        category: "person",
        stepId: e.id,
        title: e.title,
        icon: e.type,
        mood: e.mood,
        href: entityPath("person", person.id, e.id)!,
        ...(person.portrait ? { image: person.portrait } : {}),
        ...common(person.eraIds, person.themeId, e),
      });

  for (const { state, steps } of states)
    for (const s of steps)
      out.push({
        key: `state:${state.id}:${s.id}`,
        entityType: "state",
        entityId: state.id,
        entityTitle: state.name,
        category: "state",
        stepId: s.id,
        title: s.title,
        icon: STATE_ICON[s.mood] ?? "diplomacy",
        mood: s.mood,
        href: entityPath("state", state.id, s.id)!,
        ...(state.image ? { image: state.image } : {}),
        ...common(state.eraIds, state.themeId, s),
      });

  for (const { conflict, days } of conflicts)
    for (const d of days)
      out.push({
        key: `conflict:${conflict.id}:${d.id}`,
        entityType: "conflict",
        entityId: conflict.id,
        entityTitle: conflict.name,
        category: "battle",
        stepId: d.id,
        title: d.title,
        icon: WAR_DAY_ICON[d.kind],
        mood: d.mood,
        href: entityPath("conflict", conflict.id, d.id)!,
        ...common(conflict.eraIds, conflict.themeId, d, true),
      });

  return out.sort(compareIndexed);
}

/** Chronological, then by month/day when known, then by entity for a stable order. */
export function compareIndexed(a: IndexedEvent, b: IndexedEvent): number {
  return (
    a.date.year - b.date.year ||
    (a.date.month ?? 0) - (b.date.month ?? 0) ||
    (a.date.day ?? 0) - (b.date.day ?? 0) ||
    a.key.localeCompare(b.key)
  );
}

export function eventsAtPlace(index: IndexedEvent[], placeId: string): IndexedEvent[] {
  return index.filter((e) => e.placeId === placeId);
}
