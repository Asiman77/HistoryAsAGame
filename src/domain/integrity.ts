import type { Era, LifeEvent, Person, Relation } from "./schema";
import { compareDates } from "@/lib/dates";

export interface Issue {
  file: string;
  message: string;
}

/** Cross-record rules that a per-file schema cannot express. */
export function checkPerson(person: Person, events: LifeEvent[], eras: Era[], file: string): Issue[] {
  const issues: Issue[] = [];
  const add = (message: string) => issues.push({ file, message });
  const eraIds = new Set(eras.map((e) => e.id));

  for (const id of person.eraIds) if (!eraIds.has(id)) add(`naməlum era: ${id}`);
  if (person.portrait && !person.portrait.src.startsWith("http") && !person.portrait.src.startsWith("/"))
    add("portrait.src '/' və ya 'http' ilə başlamalıdır");

  issues.push(...checkPortraits(person, file));

  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const e of events) {
    if (e.personId !== person.id) add(`${e.id}: personId '${e.personId}' ≠ '${person.id}'`);
    if (ids.has(e.id)) add(`təkrarlanan event id: ${e.id}`);
    if (orders.has(e.order)) add(`təkrarlanan order: ${e.order}`);
    ids.add(e.id);
    orders.add(e.order);

    if (e.date.certainty === "disputed" && !e.date.alternatives?.length)
      add(`${e.id}: 'disputed' tarix üçün alternatives tələb olunur`);
    if (e.type === "battle" && !e.outcome) add(`${e.id}: döyüş hadisəsində outcome tələb olunur`);
    if (e.type !== "battle" && e.outcome) add(`${e.id}: outcome yalnız döyüş üçündür`);
    if (e.route && !e.fromLocation) add(`${e.id}: route var, fromLocation yoxdur`);
    if (e.narrative.az.trim() === e.factualSummary.az.trim()) add(`${e.id}: narrative və factualSummary eynidir`);
    if (e.choice && e.choice.options.length < 2) add(`${e.id}: choice ən azı 2 variant`);
  }

  const sorted = [...events].sort((a, b) => a.order - b.order);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (compareDates(cur.date, prev.date) < 0)
      add(`xronologiya pozulub: ${prev.id} (${prev.date.year}) → ${cur.id} (${cur.date.year})`);
  }

  const births = events.filter((e) => e.type === "birth");
  const deaths = events.filter((e) => e.type === "death");
  if (births.length !== 1) add(`tam bir 'birth' hadisəsi olmalıdır (tapıldı: ${births.length})`);
  if (deaths.length !== 1) add(`tam bir 'death' hadisəsi olmalıdır (tapıldı: ${deaths.length})`);
  if (sorted[0] && sorted[0].type !== "birth") add("ilk hadisə 'birth' olmalıdır");
  if (sorted.at(-1) && sorted.at(-1)!.type !== "death") add("son hadisə 'death' olmalıdır");
  if (births[0] && births[0].date.year !== person.birth.date.year)
    add("birth hadisəsinin ili person.birth ilə uyğun gəlmir");
  if (deaths[0] && deaths[0].date.year !== person.death.date.year)
    add("death hadisəsinin ili person.death ilə uyğun gəlmir");

  return issues;
}

export function checkRelations(relations: Relation[], personIds: Set<string>, file: string): Issue[] {
  return relations.flatMap((r) =>
    [r.from, r.to]
      .filter((id) => !personIds.has(id))
      .map((id) => ({ file, message: `relation naməlum şəxsiyyətə istinad edir: ${id}` })),
  );
}

export function checkEra(era: Era, file: string): Issue[] {
  return era.startYear > era.endYear ? [{ file, message: "startYear > endYear" }] : [];
}

/** Ids a person's events may point at, collected across data/. */
export interface Catalogue {
  placeIds: Set<string>;
  polityIds: Set<string>;
  snapshotIds: Set<string>;
}

export function checkEventReferences(events: LifeEvent[], cat: Catalogue, file: string): Issue[] {
  const issues: Issue[] = [];
  const add = (message: string) => issues.push({ file, message });
  for (const e of events) {
    for (const loc of [e.location, e.fromLocation]) {
      if (loc?.placeId && !cat.placeIds.has(loc.placeId)) add(`${e.id}: naməlum placeId ${loc.placeId}`);
    }
    if (e.territorySnapshotId && !cat.snapshotIds.has(e.territorySnapshotId))
      add(`${e.id}: naməlum territorySnapshotId ${e.territorySnapshotId}`);
    const o = e.outcome;
    if (o) {
      for (const id of [o.ownPolityId, o.enemyPolityId]) if (id && !cat.polityIds.has(id)) add(`${e.id}: naməlum polity ${id}`);
      for (const m of o.maneuvers ?? []) {
        const far = m.path.some(([lng, lat]) => Math.abs(lng - e.location.lng) > 2 || Math.abs(lat - e.location.lat) > 2);
        if (far) add(`${e.id}: manevr döyüş yerindən 2°-dən uzaqdadır`);
      }
    }
    if (e.narrationAudio) {
      const cues = e.narrationAudio.cues;
      for (let i = 1; i < cues.length; i++)
        if (cues[i]!.start < cues[i - 1]!.end) add(`${e.id}: narration cue-ları üst-üstə düşür (${i})`);
    }
  }
  return issues;
}

/** Earliest birth year for which AI illustrations are allowed: no AI images of real modern people. */
export const AI_PORTRAIT_MAX_BIRTH_YEAR = 1850;

export function checkPortraits(person: Person, file: string): Issue[] {
  const issues: Issue[] = [];
  const add = (message: string) => issues.push({ file, message: `portraits: ${message}` });
  const list = person.portraits ?? [];
  const lifespan = person.death.date.year - person.birth.date.year;
  const sorted = [...list].sort((a, b) => a.ageFrom - b.ageFrom);
  sorted.forEach((p, k) => {
    const where = `${p.ageFrom}–${p.ageTo}`;
    if (p.ageTo > lifespan + 1) add(`${where}: ömür müddətindən (${lifespan}) uzundur`);
    const prev = sorted[k - 1];
    if (prev && p.ageFrom <= prev.ageTo) add(`${where}: ${prev.ageFrom}–${prev.ageTo} ilə üst-üstə düşür`);
    if (p.src && !p.src.startsWith("/") && !p.src.startsWith("http")) add(`${where}: src '/' və ya 'http' ilə başlamalıdır`);
    if (p.src && !p.license) add(`${where}: şəkil var, license yoxdur`);
    if (p.src && !p.source && !p.sourceUrl) add(`${where}: şəkil var, mənbə yoxdur`);
    if (p.kind === "ai_illustration") {
      if (person.birth.date.year > AI_PORTRAIT_MAX_BIRTH_YEAR) add(`${where}: müasir real şəxslər üçün AI şəkli olmaz`);
      if (!p.promptId) add(`${where}: AI illüstrasiyası üçün promptId tələb olunur`);
    }
  });
  return issues;
}
