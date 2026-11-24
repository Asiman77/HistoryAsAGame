/**
 * Person journey → data of the final screen (§6.9), at build time: the whole
 * life route projected for the SVG replay, statistics computed from data, the
 * quiz deck, the places that earn stamps and the person to compare with.
 */
import land from "@data/territories/land.json";
import type { Locale, Person, Relation } from "@/domain/schema";
import { journeyStamps, shortPlace } from "@/features/passport/stamps";
import type { Journey } from "@/features/simulation/model";
import { linePath, polygonPath, project } from "@/features/simulation-shell/map/projection";
import type { LngLat } from "@/features/simulation-shell/types";
import { t } from "@/lib/i18n";
import { buildDeck, type QuizQuestion } from "./quiz";

export interface FinalRoute {
  /** viewBox in projected map units. */
  viewBox: string;
  /** Stroke width and dash in map units for a ~760 px wide drawing. */
  unit: number;
  land: string;
  /** Movement of each step that has one, in step order. */
  segments: { index: number; d: string }[];
  places: { name: string; x: number; y: number; firstStep: number; label: boolean; major: boolean }[];
}

export interface FinalData {
  key: string;
  name: string;
  /** "1487 — 1524" */
  years: string;
  legacy: string;
  themeId: string;
  simHref: string;
  /** `km` is formatted at build time ("9.227"), so the server and the browser print the same digits. */
  stats: { steps: number; battles: number; victories: number; defeats: number; places: number; km: string };
  /** Historical option of each choice step, to count the student's matches from saved progress. */
  choices: Record<string, number>;
  /** Index of the last step that is not a legend: reaching it finishes the journey even with legends hidden. */
  lastIndex: number;
  stepCount: number;
  route: FinalRoute;
  deck: QuizQuestion[];
  stamps: { id: string; name: string }[];
  compare: { href: string; name: string } | null;
}

/** A drawing about 760 px wide: one map unit is this many px. */
const DRAWING_PX = 760;
const fmt = (n: number) => Math.round(n * 1000) / 1000;

let landPath: string | undefined;

function routeOf(journey: Journey, locale: Locale): FinalRoute {
  const pts: [number, number][] = [];
  const segments = journey.steps.flatMap((s, index) => {
    if (!s.route || s.route.length < 2) return [];
    pts.push(...s.route.map((c) => project(c)));
    return [{ index, d: linePath(s.route) }];
  });
  const places = journey.places.map((p) => {
    const [x, y] = project([p.place.lng, p.place.lat]);
    pts.push([x, y]);
    return { name: shortPlace(t(p.place.name, locale)), x: fmt(x), y: fmt(y), firstStep: p.firstStep, steps: p.steps.length, label: false, major: false };
  });
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  let [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // At least ~6° across, so a life spent in one region is not blown up.
  const minSpan = 6;
  if (maxX - minX < minSpan) [minX, maxX] = [(minX + maxX) / 2 - minSpan / 2, (minX + maxX) / 2 + minSpan / 2];
  if (maxY - minY < minSpan * 0.6) [minY, maxY] = [(minY + maxY) / 2 - minSpan * 0.3, (minY + maxY) / 2 + minSpan * 0.3];
  const padX = (maxX - minX) * 0.16;
  const padY = (maxY - minY) * 0.18;
  const w = maxX - minX + 2 * padX;
  const h = maxY - minY + 2 * padY;
  const unit = w / DRAWING_PX;

  // Labels: places with more steps first; a label is dropped when another one is too close.
  const byWeight = [...places].sort((a, b) => b.steps - a.steps || a.firstStep - b.firstStep);
  const labelled: typeof places = [];
  for (const p of byWeight) {
    if (labelled.every((q) => Math.abs(q.x - p.x) > 90 * unit || Math.abs(q.y - p.y) > 26 * unit)) {
      p.label = true;
      labelled.push(p);
    }
  }
  for (const p of places) p.major = p.steps > 1;

  landPath ??= polygonPath(land.geometry as Parameters<typeof polygonPath>[0]);
  return {
    viewBox: [minX - padX, minY - padY, w, h].map(fmt).join(" "),
    unit: fmt(unit),
    land: landPath,
    segments,
    places: places.map(({ steps: _steps, ...p }) => p),
  };
}

export function personFinal(
  journey: Journey,
  locale: Locale,
  opts: { relations: Relation[]; persons: Person[]; years: string },
): FinalData {
  const { person, steps } = journey;
  const tr = (x: Parameters<typeof t>[0]) => t(x, locale);
  const stamps = journeyStamps(journey, locale);
  let lastIndex = steps.length - 1;
  while (lastIndex > 0 && steps[lastIndex]!.claimType === "legend") lastIndex--;

  const deckSteps = steps.map((s, index) => ({
    id: s.id,
    index,
    title: tr(s.event.title),
    year: s.year,
    yearLabel: s.event.date.certainty === "exact" ? String(s.year) : `~${s.year}`,
    place: shortPlace(tr(s.event.location.name)),
    center: [s.event.location.lng, s.event.location.lat] as LngLat,
  }));
  const deck = buildDeck({
    steps: deckSteps,
    questions: journey.quiz.map((q) => ({
      stepId: q.stepKey!,
      questionIndex: q.questionIndex ?? 0,
      question: tr(q.question),
      options: q.options.map(tr),
      correct: q.correctIndex,
      explanation: tr(q.explanation),
    })),
    claims: steps.flatMap((s) =>
      s.claims
        .filter((c) => c.claimType !== "literary")
        .map((c) => ({
          id: c.id,
          stepId: s.id,
          statement: tr(c.text),
          answer: c.claimType as "fact" | "disputed" | "legend",
          explanation: c.why ? tr(c.why) : null,
          source: (c.firstRecorded?.source ?? c.sources[0] ?? c.versions?.[0]?.sources[0])?.title ?? null,
        })),
    ),
  });

  const other = opts.relations
    .map((r) => (r.from === person.id ? r.to : r.to === person.id ? r.from : null))
    .map((id) => opts.persons.find((p) => p.id === id))
    .find((p): p is Person => !!p);

  return {
    key: person.id,
    name: tr(person.name),
    years: opts.years,
    legacy: tr(person.legacy),
    themeId: journey.themeId,
    simHref: `/sexsiyyetler/${person.id}/`,
    stats: {
      steps: steps.length,
      battles: journey.stats.battles,
      victories: journey.stats.victories,
      defeats: journey.stats.defeats,
      places: journey.stats.placeCount,
      km: new Intl.NumberFormat(locale).format(journey.stats.distanceKm),
    },
    choices: Object.fromEntries(steps.flatMap((s) => (s.event.choice ? [[s.id, s.event.choice.historicalOptionIndex]] : []))),
    lastIndex,
    stepCount: steps.length,
    route: routeOf(journey, locale),
    deck,
    stamps: stamps.map((s) => ({ id: s.id, name: s.name })),
    // The compare screen is rebuilt in phase 10; until then the current one serves it.
    compare: other ? { href: `/compare/?a=person:${person.id}&b=person:${other.id}`, name: tr(other.name) } : null,
  };
}
