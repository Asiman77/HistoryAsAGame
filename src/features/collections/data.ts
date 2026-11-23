/**
 * View models of the collection cards, built at build time from the
 * repository: only strings and numbers reach the client. Nothing here is
 * written by hand; every label comes from data or is computed from it.
 */
import { getRepository } from "@/data";
import { entityPath } from "@/domain/registry";
import type { Era, ImageAsset, Locale, Place, PlaceType } from "@/domain/schema";
import { withBasePath } from "@/lib/basePath";
import { formatDate } from "@/lib/dates";
import { formatCentury } from "@/lib/historicalDate";
import { getMessages, t } from "@/lib/i18n";
import { DEFAULT_THEME_ID, eraForYear } from "@/lib/theme";

export interface CardImage {
  src: string;
  alt: string;
}

export interface PersonCardData {
  id: string;
  href: string;
  name: string;
  /** "1487 — 1524", with the approximate prefix where the data says so. */
  years: string;
  /**
   * "Səfəvi dövləti · XVI əsr": the era the person ends in (as the simulation
   * final does) and the century of the middle of the life.
   */
  period: string;
  bio: string;
  themeId: string;
  portrait: CardImage | null;
  steps: number;
}

export interface SimCardData {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  description: string;
  themeId: string;
  image: CardImage | null;
  steps: number;
}

const image = (img: ImageAsset | undefined, locale: Locale): CardImage | null => (img ? { src: withBasePath(img.src), alt: t(img.alt, locale) } : null);

const themeOf = (eras: Era[], eraIds: string[], own?: string) => own ?? eras.find((e) => e.id === eraIds[0])?.themeId ?? DEFAULT_THEME_ID;

export async function personCards(locale: Locale): Promise<PersonCardData[]> {
  const repo = getRepository();
  const [persons, eras] = await Promise.all([repo.listPersons(), repo.listEras()]);
  const m = getMessages(locale);
  const year = (d: Parameters<typeof formatDate>[0]) => formatDate({ ...d, month: undefined, day: undefined }, m);
  const sorted = [...persons].sort((a, b) => (a.featuredOrder ?? a.birth.date.year) - (b.featuredOrder ?? b.birth.date.year));
  return Promise.all(
    sorted.map(async (p) => {
      const own = eras.filter((e) => p.eraIds.includes(e.id));
      const era = eraForYear(own, p.death.date.year) ?? own[0];
      const middle = Math.round((p.birth.date.year + p.death.date.year) / 2);
      return {
        id: p.id,
        href: entityPath("person", p.id)!,
        name: t(p.name, locale),
        years: `${year(p.birth.date)} — ${year(p.death.date)}`,
        period: [era ? t(era.name, locale) : null, formatCentury(middle)].filter(Boolean).join(" · "),
        bio: t(p.shortBio, locale),
        themeId: p.themeId ?? era?.themeId ?? DEFAULT_THEME_ID,
        portrait: image(p.portrait, locale),
        steps: (await repo.getEvents(p.id)).length,
      };
    }),
  );
}

export async function conflictCards(locale: Locale): Promise<SimCardData[]> {
  const repo = getRepository();
  const [conflicts, eras] = await Promise.all([repo.listConflicts(), repo.listEras()]);
  return Promise.all(
    conflicts.map(async (c) => ({
      id: c.id,
      href: entityPath("conflict", c.id)!,
      title: t(c.heading, locale),
      subtitle: [t(c.name, locale), c.years].join(" · "),
      description: t(c.description, locale),
      themeId: themeOf(eras, c.eraIds),
      image: null,
      steps: (await repo.getConflictDays(c.id)).length,
    })),
  );
}

export async function stateCards(locale: Locale): Promise<SimCardData[]> {
  const repo = getRepository();
  const [states, eras] = await Promise.all([repo.listStates(), repo.listEras()]);
  return Promise.all(
    states.map(async (s) => ({
      id: s.id,
      href: entityPath("state", s.id)!,
      title: t(s.name, locale),
      subtitle: s.years,
      description: t(s.description, locale),
      themeId: themeOf(eras, s.eraIds),
      image: image(s.image, locale),
      steps: (await repo.getStateSteps(s.id)).length,
    })),
  );
}

export interface PlaceCardData {
  id: string;
  href: string;
  name: string;
  /** Modern name when it differs ("Diyarbəkir"). */
  modern: string | null;
  type: PlaceType;
  events: number;
}

/** Places grouped by type, in the order of PLACE_TYPES, each group by number of events. */
export async function placeGroups(locale: Locale): Promise<{ type: PlaceType; places: PlaceCardData[] }[]> {
  const repo = getRepository();
  const [places, index] = await Promise.all([repo.listPlaces(), repo.getHistoryIndex()]);
  const counts = new Map<string, number>();
  for (const e of index) if (e.placeId) counts.set(e.placeId, (counts.get(e.placeId) ?? 0) + 1);
  const card = (p: Place): PlaceCardData => {
    const name = t(p.names.historical, locale);
    const modern = p.names.modern ? t(p.names.modern, locale) : null;
    return { id: p.id, href: entityPath("place", p.id)!, name, modern: modern && modern !== name ? modern : null, type: p.type, events: counts.get(p.id) ?? 0 };
  };
  const groups = new Map<PlaceType, PlaceCardData[]>();
  for (const p of places) groups.set(p.type, [...(groups.get(p.type) ?? []), card(p)]);
  const order: PlaceType[] = ["capital", "city", "fortress", "shrine", "port", "battlefield"];
  return order
    .filter((type) => groups.has(type))
    .map((type) => ({ type, places: groups.get(type)!.sort((a, b) => b.events - a.events || a.name.localeCompare(b.name, "az")) }));
}

/** How much content exists (home page counts, §6.1: never invented). */
export async function contentCounts() {
  const repo = getRepository();
  const [persons, conflicts, states] = await Promise.all([repo.listPersons(), repo.listConflicts(), repo.listStates()]);
  return { persons: persons.length, conflicts: conflicts.length, states: states.length };
}

/** Period theme of an entity: its own, else its first era's, else the default. */
export async function entityTheme(eraIds: string[], own?: string): Promise<string> {
  return themeOf(await getRepository().listEras(), eraIds, own);
}
