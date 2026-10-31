import type { Era, LifeEvent, Person, Relation } from "./schema";
import { dateKey } from "@/lib/dates";

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
    if (dateKey(cur.date) < dateKey(prev.date))
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
