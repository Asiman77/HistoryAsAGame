/**
 * Person journey → ShellData, at build time. Everything is resolved for the
 * page's locale; nothing is written by hand.
 */
import land from "@data/territories/land.json";
import type { Era, Locale } from "@/domain/schema";
import type { Journey } from "@/features/simulation/model";
import { withBasePath } from "@/lib/basePath";
import { formatDate } from "@/lib/dates";
import { getMessages, t } from "@/lib/i18n";
import { pickPortrait } from "@/lib/portraits";
import { eraForYear } from "@/lib/theme";
import { polygonPath } from "./map/projection";
import { deriveTemplate } from "./templates";
import type { ShellData, ShellStep } from "./types";

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

  const steps: ShellStep[] = journey.steps.map((s, index) => {
    const e = s.event;
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
      template: deriveTemplate({ hasRoute: !!s.route, battle: !!e.outcome }),
      mood: s.mood,
      themeId: s.themeId,
      claimType: s.claimType,
      center: [e.location.lng, e.location.lat],
      zoom: s.zoom,
      placeName: place,
      modernName: e.location.modernName ? tr(e.location.modernName) : null,
      approximatePlace: !!e.location.approximate,
      route: s.route,
      distanceKm: s.distanceKm,
      snapshotId: s.snapshotId,
      mapVariant: journey.themes[s.themeId]?.mapStyleVariant ?? "manuscript",
      narrative: tr(e.narrative),
      summary: tr(e.factualSummary),
      sources: e.sources.map((src) => ({ title: src.title, ...(src.author ? { author: src.author } : {}), ...(src.url ? { url: src.url } : {}), ...(src.note ? { note: src.note } : {}) })),
      related: s.related.map((r) => ({
        label: r.stepTitle ? `${tr(r.title)} · ${tr(r.stepTitle)}${r.stepYear ? ` (${r.stepYear})` : ""}` : tr(r.title),
        href: r.href,
      })),
      choice: e.choice
        ? { prompt: tr(e.choice.prompt), options: e.choice.options.map((o) => ({ text: tr(o.text), explanation: tr(o.explanation) })), historical: e.choice.historicalOptionIndex, why: tr(e.choice.why) }
        : null,
      age: { years: s.age.years, approximate: s.age.approximate },
      // The age portrait when its file exists, else the person's own portrait; an AI caption only with an AI image.
      portrait: portrait?.src
        ? { src: withBasePath(portrait.src), alt: tr(portrait.alt), ai: portrait.kind === "ai_illustration" }
        : person.portrait
          ? { src: withBasePath(person.portrait.src), alt: tr(person.portrait.alt), ai: false }
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
    places: journey.places.map((p) => ({ key: p.key, name: shortPlace(tr(p.place.name)), center: [p.place.lng, p.place.lat], firstStep: p.firstStep })),
    land: landPath,
    landmarks: journey.landmarks.map((p) => ({
      id: p.id,
      type: p.type,
      importance: p.importance,
      center: [p.lng, p.lat],
      periods: p.periods.map((r) => ({ from: r.from, to: r.to, name: tr(r.name ?? p.names.historical) })),
      modern: p.names.modern ? tr(p.names.modern) : null,
    })),
    capitals: Object.fromEntries(
      journey.snapshots
        .filter((sn) => steps.some((st) => st.snapshotId === sn.id))
        .map((sn) => [sn.id, sn.polities.flatMap((po) => (po.capitalId ? [po.capitalId] : []))]),
    ),
  };
}
