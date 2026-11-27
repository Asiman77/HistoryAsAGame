/**
 * Person journey → ShellData, at build time. Everything is resolved for the
 * page's locale; nothing is written by hand.
 */
import type { Era, Locale } from "@/domain/schema";
import type { Journey } from "@/features/simulation/model";
import { withBasePath } from "@/lib/basePath";
import { formatDate } from "@/lib/dates";
import { pickPortrait } from "@/lib/portraits";
import { eraForYear } from "@/lib/theme";
import { deriveTemplate } from "./templates";
import { journeyStamps } from "@/features/passport/stamps";
import {
  adapterContext,
  engineFields,
  shellDateNote,
  shellFrame,
  shellPrimary,
  shellSource,
  shellTerms,
  shellWorld,
  shortPlace,
} from "./stepAdapter";
import type { ShellData, ShellStep } from "./types";

/** Kinds that name the step better than its place on a timeline node. */
const KIND_AS_LABEL = new Set(["birth", "death", "coronation", "marriage"]);

/** The shell steps of a journey, indexed from 0 in the journey's order. */
export function personSteps(journey: Journey, locale: Locale): ShellStep[] {
  const c = adapterContext(locale, journey.glossary, journey.themes);
  const { m, tr } = c;
  const { person } = journey;
  const stamps = journeyStamps(journey, locale);

  return journey.steps.map((s, index) => {
    const e = s.event;
    const o = e.outcome;
    const kind = m.sim.types[e.type];
    const base = engineFields(s, index, c);
    const portrait = pickPortrait(person.portraits, s.age.years);
    return {
      ...base,
      dateLabel: formatDate(e.date, m),
      kind,
      nodeLabel: KIND_AS_LABEL.has(e.type) ? kind : shortPlace(base.placeName),
      template: deriveTemplate({ ...(e.template ? { template: e.template } : {}), hasRoute: !!s.route, battle: !!e.outcome }),
      stampId: stamps.find((st) => st.steps.includes(index))?.id ?? null,
      from: e.fromLocation ? shortPlace(tr(e.fromLocation.name)) : null,
      narrative: tr(e.narrative),
      summary: tr(e.factualSummary),
      sources: e.sources.map(shellSource),
      choice: e.choice
        ? { prompt: tr(e.choice.prompt), options: e.choice.options.map((o) => ({ text: tr(o.text), explanation: tr(o.explanation) })), historical: e.choice.historicalOptionIndex, why: tr(e.choice.why) }
        : null,
      battle: o
        ? {
            own: tr(o.ownSide),
            enemy: tr(o.enemySide),
            ownPolityId: o.ownPolityId ?? null,
            enemyPolityId: o.enemyPolityId ?? null,
            commanders: { own: o.commanders.own.map(tr), enemy: o.commanders.enemy.map(tr) },
            forces: { own: o.forces?.own ? tr(o.forces.own) : null, enemy: o.forces?.enemy ? tr(o.forces.enemy) : null },
            forcesSource: o.forces && (o.forcesSource ?? e.sources[0]) ? shellSource((o.forcesSource ?? e.sources[0])!) : null,
            result: o.result,
            context: tr(o.context),
          }
        : null,
      more: {
        date: shellDateNote(e.date, c),
        primary: shellPrimary(e.primarySource, c),
        terms: shellTerms([tr(e.narrative), tr(e.factualSummary), e.choice ? tr(e.choice.prompt) : ""], c),
        world: shellWorld(s.world, s.year, c),
      },
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
}

export function personShell(journey: Journey, eras: Era[], locale: Locale, labels: { back: string; final: string }): ShellData {
  const c = adapterContext(locale, journey.glossary, journey.themes);
  const { m, tr } = c;
  const { person } = journey;
  const year = (d: Parameters<typeof formatDate>[0]) => formatDate({ ...d, month: undefined, day: undefined }, m);
  const own = eras.filter((e) => person.eraIds.includes(e.id));
  const era = eraForYear(own, person.death.date.year) ?? own[0];
  const steps = personSteps(journey, locale);

  return {
    key: person.id,
    kind: "person",
    title: tr(person.name),
    subtitle: [era ? tr(era.name) : null, `${year(person.birth.date)} — ${year(person.death.date)}`].filter(Boolean).join(" · "),
    back: { href: "/sexsiyyetler/", label: labels.back },
    final: { href: `/sexsiyyetler/${person.id}/final/`, label: labels.final },
    steps,
    ...shellFrame(journey, steps, c),
  };
}
