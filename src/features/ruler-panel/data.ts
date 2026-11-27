/**
 * What the ruler panel needs (FRONTEND_SPEC §6.2), resolved at build time for
 * the page's locale: polities with their facts by years and their state
 * simulation, rulers with portrait and person simulation, reigns by year.
 * The panel picks the moment on the client (the year of the slider or step).
 */
import type { Locale, Place, Source } from "@/domain/schema";
import type { PoliticalContext } from "@/features/engine/types";
import { withBasePath } from "@/lib/basePath";
import { t } from "@/lib/i18n";
import { placeNameIn } from "@/lib/places";

export type PolityStatus = "rise" | "peak" | "stable" | "war" | "crisis" | "decline";

export interface PanelSource {
  title: string;
  url: string | null;
}

export interface PanelFacts {
  from: number;
  to: number;
  status: PolityStatus;
  statusNote: string;
  religion: string | null;
  languages: string | null;
  /** Polity names, resolved. */
  rivals: string[];
  allies: string[];
  sources: PanelSource[];
}

export interface PanelPolity {
  id: string;
  name: string;
  color: string;
  periods: { from: number; to: number }[];
  facts: PanelFacts[];
  /** Its state simulation: a live link, or passive ("tezliklə") when only announced. */
  state: { href: string | null } | null;
}

export interface PanelRuler {
  id: string;
  name: string;
  titles: string[];
  dynasty: string | null;
  image: { src: string; alt: string } | null;
  /** The ruler's own life simulation, when there is one. */
  personHref: string | null;
  sources: PanelSource[];
}

export interface PanelReign {
  polityId: string;
  rulerId: string;
  from: number;
  to: number;
  certainty: "exact" | "approximate" | "disputed";
}

/** A capital as the panel names it in a year. */
export interface PanelCapital {
  id: string;
  periods: { from: number; to: number; name: string }[];
  fallback: string;
}

export interface PanelPolitical {
  polities: Record<string, PanelPolity>;
  rulers: Record<string, PanelRuler>;
  reigns: PanelReign[];
  capitals: Record<string, PanelCapital>;
}

const source = (s: Source): PanelSource => ({ title: s.title, url: s.url ?? null });

export function resolvePolitical(ctx: PoliticalContext, places: readonly Place[], locale: Locale): PanelPolitical {
  const tr = (x: Parameters<typeof t>[0]) => t(x, locale);
  const nameOf = (id: string) => {
    const p = ctx.polities.find((x) => x.id === id);
    return p ? tr(p.name) : id;
  };
  return {
    polities: Object.fromEntries(
      ctx.polities.map((p) => [
        p.id,
        {
          id: p.id,
          name: tr(p.name),
          color: p.color,
          periods: p.periods,
          facts: p.facts.map((f) => ({
            from: f.from,
            to: f.to,
            status: f.status,
            statusNote: tr(f.statusNote),
            religion: f.religion ? tr(f.religion) : null,
            languages: f.languages ? tr(f.languages) : null,
            rivals: (f.rivals ?? []).map(nameOf),
            allies: (f.allies ?? []).map(nameOf),
            sources: f.sources.map(source),
          })),
          state: p.state ? { href: p.state.href } : null,
        },
      ]),
    ),
    rulers: Object.fromEntries(
      ctx.rulers.map((r) => [
        r.id,
        {
          id: r.id,
          name: tr(r.name),
          titles: r.titles.map(tr),
          dynasty: r.dynasty ? tr(r.dynasty) : null,
          image: r.image ? { src: withBasePath(r.image.src), alt: tr(r.image.alt) } : null,
          personHref: r.personHref,
          sources: r.sources.map(source),
        },
      ]),
    ),
    reigns: ctx.reigns.map((r) => ({ polityId: r.polityId, rulerId: r.rulerId, from: r.start.year, to: r.end.year, certainty: r.certainty })),
    capitals: Object.fromEntries(
      places.map((p) => [
          p.id,
        { id: p.id, periods: p.periods.map((r) => ({ from: r.from, to: r.to, name: tr(placeNameIn(p, r.from)) })), fallback: tr(p.names.historical) },
      ]),
    ),
  };
}

/** Capital name in a year (the name of that period). */
export function capitalName(c: PanelCapital | undefined, year: number): string | null {
  if (!c) return null;
  return c.periods.find((p) => year >= p.from && year <= p.to)?.name ?? c.fallback;
}

/** What the panel shows for a polity in a year. */
export function panelAt(political: PanelPolitical, polityId: string, year: number) {
  const polity = political.polities[polityId] ?? null;
  const reigns = political.reigns.filter((r) => r.polityId === polityId && r.from <= year && year <= r.to).sort((a, b) => a.from - b.from);
  const facts = polity?.facts.find((f) => f.from <= year && year <= f.to) ?? null;
  const exists = polity ? polity.periods.some((p) => p.from <= year && year <= p.to) : true;
  return { polity, reigns, facts, exists, noData: !facts && reigns.length === 0 };
}
