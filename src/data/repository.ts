import type { Registry } from "@/domain/registry";
import type { ThemeMap } from "@/lib/theme";
import type {
  Era,
  GlossaryEntry,
  LifeEvent,
  Person,
  Place,
  PlannedEntity,
  Polity,
  Reign,
  Relation,
  Ruler,
  State,
  StateStep,
  Battle,
  Commander,
  Conflict,
  Hero,
  Settlement,
  Track,
  WarDay,
  TerritorySnapshotMeta,
  WorldEvent,
} from "@/domain/schema";

export interface PersonFilter {
  eraId?: string;
  tag?: string;
}

/**
 * Data access boundary. UI code depends only on this interface, so the static
 * JSON implementation can be replaced by an HTTP one (e.g. a Spring Boot API)
 * without touching components.
 */
export interface HistoryRepository {
  listEras(): Promise<Era[]>;
  /** Period themes with variants merged over their parents, by id. */
  listThemes(): Promise<ThemeMap>;
  listPersons(filter?: PersonFilter): Promise<Person[]>;
  getPerson(id: string): Promise<Person | null>;
  /** Events sorted by `order`. */
  getEvents(personId: string): Promise<LifeEvent[]>;
  getRelations(personId: string): Promise<Relation[]>;
  getGlossary(): Promise<GlossaryEntry[]>;
  listPlaces(): Promise<Place[]>;
  listPolities(): Promise<Polity[]>;
  listRulers(): Promise<Ruler[]>;
  /** Who ruled which polity when; the ruler panel is computed from this table. */
  listReigns(): Promise<Reign[]>;
  /** Snapshot metadata sorted by year. Geometry is fetched by the browser from public/data/territories/<id>.json. */
  listTerritorySnapshots(): Promise<TerritorySnapshotMeta[]>;
  listWorldEvents(): Promise<WorldEvent[]>;
  listStates(): Promise<State[]>;
  getState(id: string): Promise<State | null>;
  /** Stages sorted by `order`. */
  getStateSteps(id: string): Promise<StateStep[]>;
  listConflicts(): Promise<Conflict[]>;
  getConflict(id: string): Promise<Conflict | null>;
  /** Days sorted by `order`. */
  getConflictDays(id: string): Promise<WarDay[]>;
  getConflictExtras(id: string): Promise<{ settlements: Settlement[]; heroes: Hero[]; commanders: Commander[]; tracks: Track[] }>;
  listBattles(): Promise<Battle[]>;
  /** Entities announced but not built yet (data/planned.json). */
  listPlanned(): Promise<PlannedEntity[]>;
  /** Index of every entity, used to resolve cross-links. */
  getRegistry(): Promise<Registry>;
}
