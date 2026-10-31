import fs from "node:fs/promises";
import path from "node:path";
import {
  Era,
  EventsFile,
  GlossaryFile,
  Person,
  RelationsFile,
  type LifeEvent,
  type Relation,
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
}
