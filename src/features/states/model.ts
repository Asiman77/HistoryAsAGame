import type {
  Era,
  EventType,
  GlossaryEntry,
  Mood,
  Place,
  QuizQuestion,
  State,
  StateStep,
  TerritorySnapshotMeta,
  WorldEvent,
} from "@/domain/schema";
import { resolveRef, type Registry } from "@/domain/registry";
import type { EngineStep, MapPlace, PoliticalContext, SimulationData } from "@/features/engine/types";
import { matchPlace, placesForSpan } from "@/lib/places";
import { pickSnapshotId } from "@/lib/territory";
import { pickWorldEvents } from "@/lib/worldContext";
import { eraViews, pickThemeId, pickThemes, type ThemeMap } from "@/lib/theme";

/** A historical stage of a state as a simulation step. */
export interface StateSimStep extends EngineStep {
  stage: StateStep;
  /** Polity this stage is about (rulers, outline). */
  polityId: string;
  world: WorldEvent[];
}

export interface StateSimulationData extends SimulationData<StateSimStep> {
  state: State;
  quiz: QuizQuestion[];
}

export const STATE_ICON: Partial<Record<Mood, EventType>> = {
  coronation: "coronation",
  battle: "battle",
  victory: "battle",
  defeat: "battle",
  death: "death",
  decline: "exile",
  hardship: "exile",
  exile: "exile",
  rise: "journey",
  journey: "journey",
  culture: "culture",
  peace: "diplomacy",
  diplomacy: "diplomacy",
};

export interface StateContext {
  eras: Era[];
  places: Place[];
  snapshots: TerritorySnapshotMeta[];
  polityColors: Record<string, string>;
  worldEvents: WorldEvent[];
  glossary: GlossaryEntry[];
  registry: Registry;
  political: PoliticalContext;
  themes: ThemeMap;
}

export function buildStateSimulation(state: State, stages: StateStep[], ctx: StateContext): StateSimulationData {
  const from = stages[0]!.date.year;
  const to = stages.at(-1)!.date.year;
  const landmarks = placesForSpan(ctx.places, from, to);
  const stateEras = ctx.eras.filter((e) => state.eraIds.includes(e.id));
  const themeOf = (year: number, stepThemeId?: string) =>
    pickThemeId({ stepThemeId, entityThemeId: state.themeId, year, entityEras: stateEras, allEras: ctx.eras });

  const steps: StateSimStep[] = stages.map((stage) => {
    const polityId = stage.polityId ?? state.polityId;
    return {
      id: stage.id,
      year: stage.date.year,
      title: stage.title,
      timelineLabel: String(stage.date.year),
      icon: STATE_ICON[stage.mood] ?? "diplomacy",
      mood: stage.mood,
      location: stage.location,
      zoom: stage.zoom ?? 4.5,
      route: null,
      distanceKm: 0,
      snapshotId: pickSnapshotId(stage.date.year, ctx.snapshots, stage.territorySnapshotId),
      placeId: matchPlace(stage.location, landmarks)?.id ?? null,
      battle: null,
      related: (stage.related ?? []).map((r) => resolveRef(r, ctx.registry)),
      focusPolityId: polityId,
      themeId: themeOf(stage.date.year, stage.themeId),
      claimType: stage.claimType ?? "fact",
      claims: stage.claims ?? [],
      ...(stage.capitalId ? { capitalId: stage.capitalId } : {}),
      stage,
      polityId,
      world: pickWorldEvents(stage.date.year, ctx.worldEvents),
    };
  });

  const places = new Map<string, MapPlace>();
  steps.forEach((s, i) => {
    const key = `${s.location.lat.toFixed(2)},${s.location.lng.toFixed(2)}`;
    const existing = places.get(key);
    if (existing) existing.steps.push(i);
    else places.set(key, { key, place: s.location, firstStep: i, steps: [i], placeId: s.placeId });
  });

  return {
    key: `state:${state.id}`,
    path: `/states/${state.id}/`,
    title: state.name,
    subtitle: state.years,
    ...(state.image ? { image: state.image } : {}),
    state,
    steps,
    places: [...places.values()],
    eras: eraViews(stateEras, ctx.themes),
    themeId: themeOf(to),
    themes: pickThemes(ctx.themes, [...steps.map((s) => s.themeId), themeOf(to)]),
    landmarks,
    snapshots: ctx.snapshots,
    polityColors: ctx.polityColors,
    glossary: ctx.glossary,
    political: ctx.political,
    quiz: stages.flatMap((s) => s.quiz ?? []),
  };
}
