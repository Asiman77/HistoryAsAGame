/**
 * Person journey → ShellData, at build time. Everything is resolved for the
 * page's locale; nothing is written by hand.
 */
import land from "@data/territories/land.json";
import { entityPath } from "@/domain/registry";
import type { Era, Locale, Source } from "@/domain/schema";
import type { Journey } from "@/features/simulation/model";
import { withBasePath } from "@/lib/basePath";
import { formatDate } from "@/lib/dates";
import { tokenizeGlossary } from "@/lib/glossary";
import { format, getMessages, t } from "@/lib/i18n";
import { pickPortrait } from "@/lib/portraits";
import { eraForYear } from "@/lib/theme";
import { polygonPath } from "./map/projection";
import { deriveTemplate } from "./templates";
import { yearDelta } from "@/lib/worldContext";
import { journeyStamps } from "@/features/passport/stamps";
import type { ShellData, ShellSource, ShellStep } from "./types";

/** Kinds that name the step better than its place on a timeline node. */
const KIND_AS_LABEL = new Set(["birth", "death", "coronation", "marriage"]);

/** "Lahican (Gilan)" → "Lahican" */
const shortPlace = (name: string) => name.replace(/\s*\(.*\)\s*$/, "").trim();

let landPath: string | undefined;

export function personShell(journey: Journey, eras: Era[], locale: Locale, labels: { back: string; final: string }): ShellData {
  const m = getMessages(locale);
  const { person } = journey;
  const tr = (x: Parameters<typeof t>[0]) => t(x, locale);
  const year = (d: Parameters<typeof formatDate>[0]) => formatDate({ ...d, month: undefined, day: undefined }, m);
  const own = eras.filter((e) => person.eraIds.includes(e.id));
  const era = eraForYear(own, person.death.date.year) ?? own[0];

  const source = (src: Source): ShellSource => ({
    title: src.title,
    ...(src.author ? { author: src.author } : {}),
    ...(src.url ? { url: src.url } : {}),
    ...(src.note ? { note: src.note } : {}),
  });
  const glossary = journey.glossary;
  const stamps = journeyStamps(journey, locale);

  const steps: ShellStep[] = journey.steps.map((s, index) => {
    const e = s.event;
    const o = e.outcome;
    // Terms of the glossary that the step's own text uses (first mention per step).
    const seen = new Set<string>();
    for (const text of [tr(e.narrative), tr(e.factualSummary), e.choice ? tr(e.choice.prompt) : ""]) tokenizeGlossary(text, glossary, seen);
    const kind = m.sim.types[e.type];
    const place = tr(e.location.name);
    const portrait = pickPortrait(person.portraits, s.age.years);
    return {
      id: s.id,
      index,
      year: s.year,
      dateLabel: formatDate(e.date, m),
      title: tr(e.title),
      kind,
      nodeLabel: KIND_AS_LABEL.has(e.type) ? kind : shortPlace(place),
      template: deriveTemplate({ ...(e.template ? { template: e.template } : {}), hasRoute: !!s.route, battle: !!e.outcome }),
      mood: s.mood,
      themeId: s.themeId,
      claimType: s.claimType,
      center: [e.location.lng, e.location.lat],
      zoom: s.zoom,
      placeName: place,
      placeId: s.placeId,
      stampId: stamps.find((st) => st.steps.includes(index))?.id ?? null,
      from: e.fromLocation ? shortPlace(tr(e.fromLocation.name)) : null,
      modernName: e.location.modernName ? tr(e.location.modernName) : null,
      approximatePlace: !!e.location.approximate,
      route: s.route,
      distanceKm: s.distanceKm,
      snapshotId: s.snapshotId,
      mapVariant: journey.themes[s.themeId]?.mapStyleVariant ?? "manuscript",
      narrative: tr(e.narrative),
      summary: tr(e.factualSummary),
      sources: e.sources.map(source),
      related: s.related.map((r) => ({
        label: r.stepTitle ? `${tr(r.title)} · ${tr(r.stepTitle)}${r.stepYear ? ` (${r.stepYear})` : ""}` : tr(r.title),
        href: r.href,
      })),
      choice: e.choice
        ? { prompt: tr(e.choice.prompt), options: e.choice.options.map((o) => ({ text: tr(o.text), explanation: tr(o.explanation) })), historical: e.choice.historicalOptionIndex, why: tr(e.choice.why) }
        : null,
      battle: o
        ? {
            own: tr(o.ownSide),
            enemy: tr(o.enemySide),
            commanders: { own: o.commanders.own.map(tr), enemy: o.commanders.enemy.map(tr) },
            forces: { own: o.forces?.own ? tr(o.forces.own) : null, enemy: o.forces?.enemy ? tr(o.forces.enemy) : null },
            forcesSource: o.forces && (o.forcesSource ?? e.sources[0]) ? source((o.forcesSource ?? e.sources[0])!) : null,
            result: o.result,
            context: tr(o.context),
          }
        : null,
      claims: s.claims.map((c) => ({
        id: c.id,
        type: c.claimType,
        text: tr(c.text),
        why: c.why ? tr(c.why) : null,
        versions: (c.versions ?? []).map((v) => ({ text: tr(v.text), sources: v.sources.map(source) })),
        firstRecorded: c.firstRecorded
          ? { source: source(c.firstRecorded.source), year: c.firstRecorded.year ?? null, note: c.firstRecorded.note ? tr(c.firstRecorded.note) : null }
          : null,
        sources: c.sources.map(source),
      })),
      more: {
        date:
          e.date.note || e.date.alternatives?.length
            ? {
                help: m.sim.certaintyHelp[e.date.certainty],
                note: e.date.note ? tr(e.date.note) : null,
                alternatives: (e.date.alternatives ?? []).map((a) => ({ date: formatDate({ ...a, certainty: "exact" }, m), note: tr(a.note) })),
              }
            : null,
        primary: e.primarySource
          ? {
              original: e.primarySource.original ?? null,
              text: tr(e.primarySource.text),
              attribution: tr(e.primarySource.attribution),
              translator: e.primarySource.translator ?? null,
              license: e.primarySource.license,
              note: e.primarySource.note ? tr(e.primarySource.note) : null,
              source: source(e.primarySource.source),
            }
          : null,
        terms: glossary.filter((g) => seen.has(g.id)).map((g) => ({ id: g.id, term: tr(g.term), definition: tr(g.definition) })),
        world: s.world.map((w) => {
          const d = yearDelta(w, s.year);
          return {
            id: w.id,
            years: w.endYear ? `${w.year}–${w.endYear}` : String(w.year),
            title: tr(w.title),
            description: tr(w.description),
            region: m.world.regions[w.region],
            when: d === 0 ? m.world.same : d < 0 ? format(m.world.before, { n: -d }) : format(m.world.after, { n: d }),
            source: w.sources[0] ? source(w.sources[0]) : null,
          };
        }),
      },
      musicThemeId: journey.themes[s.themeId]?.musicThemeId ?? null,
      age: { years: s.age.years, approximate: s.age.approximate },
      // The portrait of this age; without its file a placeholder, never another age's portrait.
      portrait: portrait
        ? {
            key: `${portrait.ageFrom}-${portrait.ageTo}`,
            src: portrait.src ? withBasePath(portrait.src) : null,
            alt: tr(portrait.alt),
            kind: portrait.kind,
            ages: { from: portrait.ageFrom, to: portrait.ageTo },
            caption: portrait.caption ? tr(portrait.caption) : null,
            credit: { author: portrait.author ?? null, license: portrait.license ?? null, url: portrait.sourceUrl ?? null },
          }
        : person.portrait
          ? {
              key: "person",
              src: withBasePath(person.portrait.src),
              alt: tr(person.portrait.alt),
              kind: null,
              ages: null,
              caption: null,
              credit: { author: person.portrait.author ?? null, license: person.portrait.license, url: person.portrait.sourceUrl ?? null },
            }
          : null,
    };
  });

  landPath ??= polygonPath(land.geometry as Parameters<typeof polygonPath>[0]);

  return {
    key: person.id,
    kind: "person",
    title: tr(person.name),
    subtitle: [era ? tr(era.name) : null, `${year(person.birth.date)} — ${year(person.death.date)}`].filter(Boolean).join(" · "),
    back: { href: "/sexsiyyetler/", label: labels.back },
    final: { href: `/sexsiyyetler/${person.id}/final/`, label: labels.final },
    steps,
    places: journey.places.map((p) => ({ key: p.key, name: shortPlace(tr(p.place.name)), center: [p.place.lng, p.place.lat], firstStep: p.firstStep, placeId: p.placeId })),
    land: landPath,
    landmarks: journey.landmarks.map((p) => ({
      id: p.id,
      type: p.type,
      importance: p.importance,
      center: [p.lng, p.lat],
      periods: p.periods.map((r) => ({ from: r.from, to: r.to, name: tr(r.name ?? p.names.historical) })),
      modern: p.names.modern ? tr(p.names.modern) : null,
      description: tr(p.description),
      source: p.sources?.[0] ? source(p.sources[0]) : null,
      href: entityPath("place", p.id),
    })),
    capitals: Object.fromEntries(
      journey.snapshots
        .filter((sn) => steps.some((st) => st.snapshotId === sn.id))
        .map((sn) => [sn.id, sn.polities.flatMap((po) => (po.capitalId ? [po.capitalId] : []))]),
    ),
  };
}
