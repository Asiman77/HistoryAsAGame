import { quizOf, type TrackedQuizQuestion } from "@/lib/analytics/quiz";
import type {
  Commander,
  Conflict,
  EventType,
  GlossaryEntry,
  Era,
  Hero,
  Mood,
  Place,
  Settlement,
  TerritorySnapshotMeta,
  Track,
  WarDay,
} from "@/domain/schema";
import { resolveRef, type Registry } from "@/domain/registry";
import type { EngineStep, MapPlace, PoliticalContext, SimulationData } from "@/features/engine/types";
import { placesForSpan } from "@/lib/places";
import { pickSnapshotId } from "@/lib/territory";
import { eraViews, pickThemeId, pickThemes, type ThemeMap } from "@/lib/theme";

export interface ConflictStep extends EngineStep {
  day: WarDay;
  /** Settlements announced on this step. */
  liberatedNow: Settlement[];
  /** Total announced so far (named settlements counted once, plus places announced only by number). */
  liberatedTotal: number;
}

export interface ConflictSimulationData extends SimulationData<ConflictStep> {
  conflict: Conflict;
  settlements: Settlement[];
  /** Step index at which each settlement was first announced (for the map). */
  liberatedAt: Record<string, number>;
  heroes: Hero[];
  commanders: Commander[];
  /** Only tracks whose rights holders have agreed; pending ones are not shipped. */
  tracks: Track[];
  pendingTracks: number;
  quiz: TrackedQuizQuestion[];
}

export const WAR_DAY_ICON: Record<WarDay["kind"], EventType> = {
  operation: "battle",
  liberation: "battle",
  memorial: "death",
  statement: "diplomacy",
  epilogue: "journey",
};

const SHORT_MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];

export interface ConflictContext {
  themes: ThemeMap;
  eras: Era[];
  places: Place[];
  snapshots: TerritorySnapshotMeta[];
  polityColors: Record<string, string>;
  glossary: GlossaryEntry[];
  registry: Registry;
  political: PoliticalContext;
  settlements: Settlement[];
  heroes: Hero[];
  commanders: Commander[];
  tracks: Track[];
}

export function buildConflictSimulation(conflict: Conflict, days: WarDay[], ctx: ConflictContext): ConflictSimulationData {
  const byId = new Map(ctx.settlements.map((s) => [s.id, s]));
  const conflictEras = ctx.eras.filter((e) => conflict.eraIds.includes(e.id));
  const themeOf = (year: number, stepThemeId?: string) =>
    pickThemeId({ stepThemeId, entityThemeId: conflict.themeId, year, entityEras: conflictEras, allEras: ctx.eras });
  const liberatedAt: Record<string, number> = {};
  let extra = 0;
  const steps: ConflictStep[] = days.map((day, i) => {
    const now = (day.liberated ?? []).map((id) => byId.get(id)).filter((s): s is Settlement => !!s);
    for (const s of now) if (liberatedAt[s.id] === undefined) liberatedAt[s.id] = i;
    extra += (day.extraLiberated?.villages ?? 0) + (day.extraLiberated?.towns ?? 0);
    const mood: Mood = day.mood;
    return {
      id: day.id,
      year: day.date.year,
      title: day.title,
      timelineLabel: `${day.date.day} ${SHORT_MONTHS[(day.date.month ?? 1) - 1]}`,
      icon: WAR_DAY_ICON[day.kind],
      mood,
      location: day.location,
      zoom: day.zoom ?? 8,
      route: null,
      distanceKm: 0,
      snapshotId: pickSnapshotId(day.date.year, ctx.snapshots, day.territorySnapshotId),
      placeId: null,
      battle: null,
      related: (day.related ?? []).map((r) => resolveRef(r, ctx.registry)),
      focusPolityId: "azerbaijan",
      themeId: themeOf(day.date.year, day.themeId),
      claimType: day.claimType ?? "fact",
      claims: day.claims ?? [],
      day,
      liberatedNow: now,
      liberatedTotal: Object.entries(liberatedAt).filter(([id, v]) => v <= i && byId.get(id)?.kind !== "district").length + extra,
    };
  });
  // Memorial cities get journey markers; liberated settlements are drawn by the liberation layer.
  const places: MapPlace[] = steps
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.day.kind === "memorial")
    .map(({ s, i }) => ({ key: s.id, place: s.location, firstStep: i, steps: [i], placeId: null }));

  return {
    key: `conflict:${conflict.id}`,
    path: `/conflicts/${conflict.id}/`,
    title: conflict.name,
    subtitle: conflict.years,
    conflict,
    steps,
    places,
    eras: eraViews(conflictEras, ctx.themes),
    themeId: themeOf(days.at(-1)!.date.year),
    themes: pickThemes(ctx.themes, [...steps.map((s) => s.themeId), themeOf(days.at(-1)!.date.year)]),
    landmarks: placesForSpan(ctx.places, 2020, 2020),
    snapshots: ctx.snapshots,
    polityColors: ctx.polityColors,
    glossary: ctx.glossary,
    political: ctx.political,
    settlements: ctx.settlements,
    liberatedAt,
    heroes: ctx.heroes,
    commanders: ctx.commanders,
    tracks: ctx.tracks.filter((t) => t.permissionStatus === "granted"),
    pendingTracks: ctx.tracks.filter((t) => t.permissionStatus !== "granted").length,
    quiz: quizOf(days),
  };
}
