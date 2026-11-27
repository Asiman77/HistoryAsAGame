/**
 * What every adapter (person, state, war, curriculum topic) maps the same way:
 * the engine fields of a step, sources, claims, links, the "Ətraflı" parts and
 * the map frame of a simulation. Resolved at build time for the page's locale.
 */
import land from "@data/territories/land.json";
import { entityPath, type ResolvedRef } from "@/domain/registry";
import type { Claim, GlossaryEntry, HistoricalDate, LifeEvent, Locale, Source, WorldEvent } from "@/domain/schema";
import type { EngineStep, SimulationData } from "@/features/engine/types";
import { resolvePolitical } from "@/features/ruler-panel/data";
import { formatDate } from "@/lib/dates";
import { tokenizeGlossary } from "@/lib/glossary";
import { format, getMessages, t, type Messages } from "@/lib/i18n";
import type { ThemeMap } from "@/lib/theme";
import { yearDelta } from "@/lib/worldContext";
import { polygonPath } from "./map/projection";
import type { ShellClaim, ShellData, ShellMore, ShellSource, ShellStep } from "./types";

export interface AdapterContext {
  locale: Locale;
  m: Messages;
  tr: (x: Parameters<typeof t>[0]) => string;
  glossary: readonly GlossaryEntry[];
  themes: ThemeMap;
}

export function adapterContext(locale: Locale, glossary: readonly GlossaryEntry[], themes: ThemeMap): AdapterContext {
  return { locale, m: getMessages(locale), tr: (x) => t(x, locale), glossary, themes };
}

/** "Lahican (Gilan)" → "Lahican" */
export const shortPlace = (name: string) => name.replace(/\s*\(.*\)\s*$/, "").trim();

export const shellSource = (src: Source): ShellSource => ({
  title: src.title,
  ...(src.author ? { author: src.author } : {}),
  ...(src.url ? { url: src.url } : {}),
  ...(src.note ? { note: src.note } : {}),
});

export function shellClaims(claims: readonly Claim[], c: AdapterContext): ShellClaim[] {
  return claims.map((cl) => ({
    id: cl.id,
    type: cl.claimType,
    text: c.tr(cl.text),
    why: cl.why ? c.tr(cl.why) : null,
    versions: (cl.versions ?? []).map((v) => ({ text: c.tr(v.text), sources: v.sources.map(shellSource) })),
    firstRecorded: cl.firstRecorded
      ? { source: shellSource(cl.firstRecorded.source), year: cl.firstRecorded.year ?? null, note: cl.firstRecorded.note ? c.tr(cl.firstRecorded.note) : null }
      : null,
    sources: cl.sources.map(shellSource),
  }));
}

export function shellRelated(related: readonly ResolvedRef[], c: AdapterContext): ShellStep["related"] {
  return related.map((r) => ({
    label: r.stepTitle ? `${c.tr(r.title)} · ${c.tr(r.stepTitle)}${r.stepYear ? ` (${r.stepYear})` : ""}` : c.tr(r.title),
    href: r.href,
  }));
}

/** Why the date is uncertain and the other dates the sources give; null when exact and plain. */
export function shellDateNote(date: HistoricalDate, c: AdapterContext): ShellMore["date"] {
  if (!date.note && !date.alternatives?.length) return null;
  return {
    help: c.m.sim.certaintyHelp[date.certainty],
    note: date.note ? c.tr(date.note) : null,
    alternatives: (date.alternatives ?? []).map((a) => ({ date: formatDate({ ...a, certainty: "exact" }, c.m), note: c.tr(a.note) })),
  };
}

export function shellPrimary(p: LifeEvent["primarySource"], c: AdapterContext): ShellMore["primary"] {
  if (!p) return null;
  return {
    original: p.original ?? null,
    text: c.tr(p.text),
    attribution: c.tr(p.attribution),
    translator: p.translator ?? null,
    license: p.license,
    note: p.note ? c.tr(p.note) : null,
    source: shellSource(p.source),
  };
}

/** Glossary terms the step's own text uses (first mention per step). */
export function shellTerms(texts: readonly string[], c: AdapterContext): ShellMore["terms"] {
  const seen = new Set<string>();
  for (const text of texts) tokenizeGlossary(text, c.glossary, seen);
  return c.glossary.filter((g) => seen.has(g.id)).map((g) => ({ id: g.id, term: c.tr(g.term), definition: c.tr(g.definition) }));
}

/** "Bu zaman dünyada": events elsewhere around the step year. */
export function shellWorld(world: readonly WorldEvent[], year: number, c: AdapterContext): ShellMore["world"] {
  return world.map((w) => {
    const d = yearDelta(w, year);
    return {
      id: w.id,
      years: w.endYear ? `${w.year}–${w.endYear}` : String(w.year),
      title: c.tr(w.title),
      description: c.tr(w.description),
      region: c.m.world.regions[w.region],
      when: d === 0 ? c.m.world.same : d < 0 ? format(c.m.world.before, { n: -d }) : format(c.m.world.after, { n: d }),
      source: w.sources[0] ? shellSource(w.sources[0]) : null,
    };
  });
}

/** The fields of a shell step that come straight from the engine step, the same for every kind. */
export function engineFields(s: EngineStep, index: number, c: AdapterContext) {
  return {
    id: s.id,
    index,
    year: s.year,
    title: c.tr(s.title),
    mood: s.mood,
    themeId: s.themeId,
    claimType: s.claimType,
    center: [s.location.lng, s.location.lat] as ShellStep["center"],
    zoom: s.zoom,
    placeName: c.tr(s.location.name),
    placeId: s.placeId,
    modernName: s.location.modernName ? c.tr(s.location.modernName) : null,
    approximatePlace: !!s.location.approximate,
    route: s.route,
    distanceKm: s.distanceKm,
    snapshotId: s.snapshotId,
    mapVariant: c.themes[s.themeId]?.mapStyleVariant ?? "manuscript",
    related: shellRelated(s.related, c),
    claims: shellClaims(s.claims, c),
    musicThemeId: c.themes[s.themeId]?.musicThemeId ?? null,
  } satisfies Partial<ShellStep>;
}

let landPath: string | undefined;

/** Projected land outline for the schematic map, computed once per build. */
export function landOutline(): string {
  landPath ??= polygonPath(land.geometry as Parameters<typeof polygonPath>[0]);
  return landPath;
}

/** The map around the steps of a simulation: places, landmarks, rulers, the snapshots the steps use. */
export function shellFrame(
  sim: Pick<SimulationData, "places" | "landmarks" | "snapshots" | "political">,
  steps: readonly ShellStep[],
  c: AdapterContext,
): Pick<ShellData, "places" | "land" | "landmarks" | "political" | "snapshots" | "capitals"> {
  const used = sim.snapshots.filter((sn) => steps.some((st) => st.snapshotId === sn.id));
  return {
    places: sim.places.map((p) => ({ key: p.key, name: shortPlace(c.tr(p.place.name)), center: [p.place.lng, p.place.lat], firstStep: p.firstStep, placeId: p.placeId })),
    land: landOutline(),
    landmarks: sim.landmarks.map((p) => ({
      id: p.id,
      type: p.type,
      importance: p.importance,
      center: [p.lng, p.lat],
      periods: p.periods.map((r) => ({ from: r.from, to: r.to, name: c.tr(r.name ?? p.names.historical) })),
      modern: p.names.modern ? c.tr(p.names.modern) : null,
      description: c.tr(p.description),
      source: p.sources?.[0] ? shellSource(p.sources[0]) : null,
      href: entityPath("place", p.id),
    })),
    political: resolvePolitical(
      sim.political,
      sim.landmarks.filter((p) => sim.snapshots.some((sn) => sn.polities.some((po) => po.capitalId === p.id))),
      c.locale,
    ),
    snapshots: used.map((sn) => ({
      id: sn.id,
      polities: sn.polities.map((po) => ({
        id: po.id,
        name: c.tr(po.name),
        ...(po.capitalId ? { capitalId: po.capitalId } : {}),
        ...(po.vassalOf ? { vassalOf: po.vassalOf } : {}),
      })),
    })),
    capitals: Object.fromEntries(used.map((sn) => [sn.id, sn.polities.flatMap((po) => (po.capitalId ? [po.capitalId] : []))])),
  };
}
