import fs from "node:fs/promises";
import path from "node:path";
import {
  Era,
  EventsFile,
  GlossaryFile,
  Person,
  PlacesFile,
  RelationsFile,
  TerritoryRegistryFile,
  TerritorySnapshotSource,
  WorldEventsFile,
  type LifeEvent,
  type Relation,
  type TerritorySnapshotMeta,
} from "@/domain/schema";
import type { HistoryRepository, PersonFilter } from "./repository";

/**
 * Reads data/ at build time. Persons are discovered by scanning
 * data/persons/<id>/, so adding a person means adding a folder.
 */
export class FileSystemRepository implements HistoryRepository {
  private cache = new Map<string, Promise<unknown>>();

  constructor(private readonly root: string = path.join(process.cwd(), "data")) {}

  private memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!this.cache.has(key)) this.cache.set(key, load());
    return this.cache.get(key) as Promise<T>;
  }

  private async readJson(...segments: string[]): Promise<unknown> {
    const file = path.join(this.root, ...segments);
    return JSON.parse(await fs.readFile(file, "utf8"));
  }

  private async exists(...segments: string[]): Promise<boolean> {
    try {
      await fs.access(path.join(this.root, ...segments));
      return true;
    } catch {
      return false;
    }
  }

  private async jsonFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(path.join(this.root, dir));
    return entries.filter((f) => f.endsWith(".json")).sort();
  }

  listEras(): Promise<Era[]> {
    return this.memo("eras", async () => {
      const files = await this.jsonFiles("eras");
      const eras = await Promise.all(files.map(async (f) => Era.parse(await this.readJson("eras", f))));
      return eras.sort((a, b) => a.startYear - b.startYear);
    });
  }

  private allPersons(): Promise<Person[]> {
    return this.memo("persons", async () => {
      const dirs = await fs.readdir(path.join(this.root, "persons"), { withFileTypes: true });
      const persons = await Promise.all(
        dirs
          .filter((d) => d.isDirectory())
          .map(async (d) => Person.parse(await this.readJson("persons", d.name, "person.json"))),
      );
      return persons.sort(
        (a, b) =>
          (a.featuredOrder ?? Infinity) - (b.featuredOrder ?? Infinity) ||
          a.birth.date.year - b.birth.date.year,
      );
    });
  }

  async listPersons(filter?: PersonFilter): Promise<Person[]> {
    const persons = await this.allPersons();
    return persons.filter(
      (p) =>
        (!filter?.eraId || p.eraIds.includes(filter.eraId)) &&
        (!filter?.tag || p.tags.includes(filter.tag)),
    );
  }

  async getPerson(id: string): Promise<Person | null> {
    return (await this.allPersons()).find((p) => p.id === id) ?? null;
  }

  getEvents(personId: string): Promise<LifeEvent[]> {
    return this.memo(`events:${personId}`, async () => {
      if (!(await this.exists("persons", personId, "events.json"))) return [];
      const { events } = EventsFile.parse(await this.readJson("persons", personId, "events.json"));
      return [...events].sort((a, b) => a.order - b.order);
    });
  }

  async getRelations(personId: string): Promise<Relation[]> {
    const all = await this.memo("relations", async () =>
      (await this.exists("relations.json"))
        ? RelationsFile.parse(await this.readJson("relations.json")).relations
        : [],
    );
    return all.filter((r) => r.from === personId || r.to === personId);
  }

  getGlossary() {
    return this.memo("glossary", async () =>
      (await this.exists("glossary.json"))
        ? GlossaryFile.parse(await this.readJson("glossary.json")).entries
        : [],
    );
  }

  listPlaces() {
    return this.memo("places", async () =>
      (await this.exists("places.json")) ? PlacesFile.parse(await this.readJson("places.json")).places : [],
    );
  }

  private registry() {
    return this.memo("territory-registry", async () =>
      TerritoryRegistryFile.parse(await this.readJson("territories", "registry.json")),
    );
  }

  async listPolities() {
    return (await this.registry()).polities;
  }

  listTerritorySnapshots(): Promise<TerritorySnapshotMeta[]> {
    return this.memo("territory-snapshots", async () => {
      if (!(await this.exists("territories", "snapshots"))) return [];
      const { polities } = await this.registry();
      const byId = new Map(polities.map((p) => [p.id, p]));
      const files = await this.jsonFiles(path.join("territories", "snapshots"));
      const metas = await Promise.all(
        files.map(async (f): Promise<TerritorySnapshotMeta> => {
          const s = TerritorySnapshotSource.parse(await this.readJson("territories", "snapshots", f));
          return {
            id: s.id,
            year: s.year,
            title: s.title,
            certainty: s.certainty,
            ...(s.note ? { note: s.note } : {}),
            sources: s.sources,
            polities: s.polities.map((p) => {
              const meta = byId.get(p.polityId);
              return {
                id: p.polityId,
                name: p.name ?? meta?.name ?? { az: p.polityId },
                color: meta?.color ?? "#888888",
                ...(p.capitalId ? { capitalId: p.capitalId } : {}),
                ...(p.vassalOf ? { vassalOf: p.vassalOf } : {}),
              };
            }),
          };
        }),
      );
      return metas.sort((a, b) => a.year - b.year);
    });
  }

  listWorldEvents() {
    return this.memo("world-events", async () =>
      (await this.exists("world-events.json"))
        ? WorldEventsFile.parse(await this.readJson("world-events.json")).events
        : [],
    );
  }
}
