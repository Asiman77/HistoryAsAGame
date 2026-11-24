import { z } from "zod";
import * as S from "./schema";

/**
 * Which schema every file under data/ follows. This manifest is the bridge between the
 * Zod model and shared/schema (JSON Schema, read by the backend): the export script turns
 * it into shared/schema/files.json, and tests check that every data file is covered.
 */

const LngLat = z.tuple([z.number(), z.number()]);
const Ring = z.array(LngLat);
const PolygonGeometry = z.object({ type: z.literal("Polygon"), coordinates: z.array(Ring) });
const MultiPolygonGeometry = z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(Ring)) });
const AreaGeometry = z.union([PolygonGeometry, MultiPolygonGeometry]);

/** data/conflicts/<id>/settlements.json: places that changed hands, with the attribution of the names and coordinates. */
export const SettlementsFile = z.object({ source: z.string().min(1), settlements: z.array(S.Settlement) });

/** data/territories/countries.json: present-day borders by ISO 3166 alpha-3 code (Natural Earth, public domain). */
export const CountriesFile = z.object({
  source: z.string().min(1),
  countries: z.record(z.string().regex(/^[A-Z]{3}$/), AreaGeometry),
});

/** data/territories/land.json: coastline mask (Natural Earth, public domain). */
export const LandFile = z.object({
  type: z.literal("Feature"),
  properties: z.record(z.string(), z.unknown()),
  geometry: AreaGeometry,
});

export interface DataFileSpec {
  /** Glob relative to data/ ("*" never crosses a "/"). */
  pattern: string;
  /** Schema name in shared/schema (<name>.schema.json). */
  schema: string;
  zod: z.ZodType;
}

export const DATA_FILES: DataFileSpec[] = [
  { pattern: "persons/*/person.json", schema: "Person", zod: S.Person },
  { pattern: "persons/*/events.json", schema: "EventsFile", zod: S.EventsFile },
  { pattern: "relations.json", schema: "RelationsFile", zod: S.RelationsFile },
  { pattern: "eras/*.json", schema: "Era", zod: S.Era },
  { pattern: "themes/*.json", schema: "ThemeFile", zod: S.ThemeFile },
  { pattern: "places.json", schema: "PlacesFile", zod: S.PlacesFile },
  { pattern: "polities/*.json", schema: "Polity", zod: S.Polity },
  { pattern: "rulers.json", schema: "RulersFile", zod: S.RulersFile },
  { pattern: "reigns.json", schema: "ReignsFile", zod: S.ReignsFile },
  { pattern: "territories/registry.json", schema: "TerritoryRegistryFile", zod: S.TerritoryRegistryFile },
  { pattern: "territories/snapshots/*.json", schema: "TerritorySnapshotSource", zod: S.TerritorySnapshotSource },
  { pattern: "territories/countries.json", schema: "CountriesFile", zod: CountriesFile },
  { pattern: "territories/land.json", schema: "LandFile", zod: LandFile },
  { pattern: "states/*/state.json", schema: "State", zod: S.State },
  { pattern: "states/*/steps.json", schema: "StateStepsFile", zod: S.StateStepsFile },
  { pattern: "conflicts/*/conflict.json", schema: "Conflict", zod: S.Conflict },
  { pattern: "conflicts/*/days.json", schema: "WarDaysFile", zod: S.WarDaysFile },
  { pattern: "conflicts/*/settlements.json", schema: "SettlementsFile", zod: SettlementsFile },
  { pattern: "conflicts/*/commanders.json", schema: "CommandersFile", zod: S.CommandersFile },
  { pattern: "conflicts/*/heroes.json", schema: "HeroesFile", zod: S.HeroesFile },
  { pattern: "conflicts/*/soundtrack.json", schema: "SoundtrackFile", zod: S.SoundtrackFile },
  { pattern: "conflicts/*/battles/*.json", schema: "Battle", zod: S.Battle },
  { pattern: "glossary.json", schema: "GlossaryFile", zod: S.GlossaryFile },
  { pattern: "commemorations.json", schema: "CommemorationsFile", zod: S.CommemorationsFile },
  { pattern: "world-events.json", schema: "WorldEventsFile", zod: S.WorldEventsFile },
  { pattern: "planned.json", schema: "PlannedFile", zod: S.PlannedFile },
];

/** Files under data/ that are documentation, not content. */
export const NON_CONTENT_FILES = ["territories/README.md"];

/**
 * Building blocks shared by several file schemas. Each becomes its own file in
 * shared/schema and is referenced with $ref, so the backend can validate a single
 * step or claim, not only whole files.
 */
export const SHARED_SCHEMAS: Record<string, z.ZodType> = {
  LocalizedText: S.LocalizedText,
  Source: S.Source,
  Certainty: S.Certainty,
  ClaimType: S.ClaimType,
  Mood: S.Mood,
  StepTemplate: S.StepTemplate,
  HistoricalDate: S.HistoricalDate,
  Location: S.Location,
  EntityRef: S.EntityRef,
  Claim: S.Claim,
  ImageAsset: S.ImageAsset,
  AgePortrait: S.AgePortrait,
  BattleOutcome: S.BattleOutcome,
  Choice: S.Choice,
  QuizQuestion: S.QuizQuestion,
  NarrationAudio: S.NarrationAudio,
  PrimaryExcerpt: S.PrimaryExcerpt,
  LifeEvent: S.LifeEvent,
  StateStep: S.StateStep,
  WarDay: S.WarDay,
  Place: S.Place,
  Ruler: S.Ruler,
  Reign: S.Reign,
  Relation: S.Relation,
  ThemeUi: S.ThemeUi,
  Theme: S.Theme,
  ThemeVariant: S.ThemeVariant,
  Settlement: S.Settlement,
  Commander: S.Commander,
  Hero: S.Hero,
  Track: S.Track,
  GlossaryEntry: S.GlossaryEntry,
  Commemoration: S.Commemoration,
  WorldEvent: S.WorldEvent,
  /** Built snapshot with geometry (public/data/territories), the format a TERRITORY_SNAPSHOT document carries. */
  TerritorySnapshot: S.TerritorySnapshot,
};

/** Matches a data/ path against a manifest glob; "*" matches within one path segment. */
export function matchesPattern(relativePath: string, pattern: string): boolean {
  const re = new RegExp(
    "^" + pattern.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+") + "$",
  );
  return re.test(relativePath);
}
