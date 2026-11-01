import type {
  Era,
  GlossaryEntry,
  LifeEvent,
  Person,
  Place,
  Polity,
  Relation,
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
  listPersons(filter?: PersonFilter): Promise<Person[]>;
  getPerson(id: string): Promise<Person | null>;
  /** Events sorted by `order`. */
  getEvents(personId: string): Promise<LifeEvent[]>;
  getRelations(personId: string): Promise<Relation[]>;
  getGlossary(): Promise<GlossaryEntry[]>;
  listPlaces(): Promise<Place[]>;
  listPolities(): Promise<Polity[]>;
  /** Snapshot metadata sorted by year. Geometry is fetched by the browser from public/data/territories/<id>.json. */
  listTerritorySnapshots(): Promise<TerritorySnapshotMeta[]>;
  listWorldEvents(): Promise<WorldEvent[]>;
}
