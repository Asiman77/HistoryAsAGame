import type {
  BattleOutcome,
  Claim,
  ClaimType,
  EventType,
  GlossaryEntry,
  ImageAsset,
  LocalizedText,
  Location,
  Mood,
  Place,
  PolityFacts,
  Reign,
  Source,
  TerritorySnapshotMeta,
} from "@/domain/schema";
import type { ResolvedRef } from "@/domain/registry";
import type { LngLat } from "@/lib/geo";
import type { EraView, ThemeMap } from "@/lib/theme";

/**
 * What every simulation step has in common, whatever it stands for: a life
 * event (person), a war day (conflict) or a historical stage (state). The
 * engine (map, timeline, mood, sound, navigation) only reads these fields.
 */
export interface EngineStep {
  /** Stable id, also used in deep links (?step=). */
  id: string;
  year: number;
  title: LocalizedText;
  /** Short label under the timeline node, e.g. "1514" or "8 noy". */
  timelineLabel: string;
  icon: EventType;
  mood: Mood;
  /** Where the camera goes and the marker sits. */
  location: Location;
  zoom: number;
  /** Smoothed movement path, null when nothing moves. */
  route: LngLat[] | null;
  distanceKm: number;
  snapshotId: string | null;
  /** Catalogue place at this location, if any. */
  placeId: string | null;
  /** Battle scene: sides, commanders, schematic arrows. */
  battle: BattleOutcome | null;
  related: ResolvedRef[];
  /** Polity outlined on the map (the state a state simulation is about). */
  focusPolityId?: string;
  /** Capital to emphasise on the map in this step. */
  capitalId?: string;
  /** Period theme of this step (data/themes): step variant → entity → era. */
  themeId: string;
  /** The step as a whole: fact unless the data says it rests on a legend or is disputed. */
  claimType: ClaimType;
  /** Classified statements shown under "Fakt və rəvayət". */
  claims: Claim[];
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

/** Everything the engine needs, computed at build time and serialisable. */
export interface SimulationData<S extends EngineStep = EngineStep> {
  /** Entity key, e.g. "person:shah-ismayil"; also the progress key. */
  key: string;
  /** Path of this simulation without locale, e.g. "/persons/shah-ismayil/". */
  path: string;
  title: LocalizedText;
  subtitle: string;
  image?: ImageAsset;
  steps: S[];
  places: MapPlace[];
  eras: EraView[];
  /** Theme of the final screen and the start gate. */
  themeId: string;
  /** Every theme the steps use, resolved. */
  themes: ThemeMap;
  landmarks: Place[];
  snapshots: TerritorySnapshotMeta[];
  polityColors: Record<string, string>;
  glossary: GlossaryEntry[];
  political: PoliticalContext;
}

/** What the ruler panel needs, resolved at build time. */
export interface PolityView {
  id: string;
  name: LocalizedText;
  color: string;
  periods: { from: number; to: number }[];
  facts: PolityFacts[];
  /** State simulation for this polity: live link, "tezliklə", or none. */
  state: ResolvedRef | null;
}

export interface RulerView {
  id: string;
  name: LocalizedText;
  titles: LocalizedText[];
  dynasty?: LocalizedText;
  born?: number;
  died?: number;
  image?: ImageAsset;
  /** Person simulation of this ruler. */
  personHref: string | null;
  sources: Source[];
}

export interface PoliticalContext {
  polities: PolityView[];
  rulers: RulerView[];
  reigns: Reign[];
}

export interface Counter {
  label: string;
  value: number;
  prefix?: string;
  /** Visual emphasis (e.g. the age in carmine). */
  accent?: boolean;
}

/** Persons that a step crosses into: shown as map medallions and a gold dot on the timeline. */
export const crossings = (s: EngineStep) => s.related.filter((r) => r.type === "person" && r.href);
