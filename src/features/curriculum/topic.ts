/**
 * A curriculum topic as one simulation (FRONTEND_SPEC §6.4): the steps it
 * names, taken from person, state and war simulations, told in the topic's
 * own order in the SimulationShell. At the end a quiz built from those steps
 * and the next topic of the grade. Everything comes from the data at build time.
 */
import { loadPoliticalContext } from "@/data/political";
import type { HistoryRepository } from "@/data/repository";
import type { Claim, CurriculumGrade, CurriculumTopic, Locale, QuizQuestion as DataQuiz, TopicStepRef } from "@/domain/schema";
import { buildConflictSimulation } from "@/features/conflicts/model";
import { buildDeck, type QuizQuestion } from "@/features/final/quiz";
import { buildJourney } from "@/features/simulation/model";
import { conflictSteps } from "@/features/simulation-shell/conflictAdapter";
import { personSteps } from "@/features/simulation-shell/personAdapter";
import { stateSteps } from "@/features/simulation-shell/stateAdapter";
import { adapterContext, landOutline, shellFrame, shortPlace } from "@/features/simulation-shell/stepAdapter";
import type { ShellData, ShellPlace, ShellStep } from "@/features/simulation-shell/types";
import { buildStateSimulation } from "@/features/states/model";
import { t } from "@/lib/i18n";
import { placesForSpan } from "@/lib/places";
import type { ThemeMap } from "@/lib/theme";
import { allTopics, topicPath, type OwnerType, type StepOwner } from "./data";
import { entityPath } from "@/domain/registry";

/** What the quiz needs from a step of the data, whatever simulation it comes from. */
interface RawStep {
  quiz?: DataQuiz[];
  claims?: Claim[];
  date: { year: number; certainty: string };
}

interface OwnerSteps {
  owner: StepOwner;
  steps: Map<string, { shell: ShellStep; raw: RawStep }>;
  themes: ThemeMap;
}

const EMPTY_POLITICAL = { polities: [], rulers: [], reigns: [] };

/** The steps of one simulation as the shell shows them, with the data each came from. */
async function ownerSteps(repo: HistoryRepository, type: OwnerType, id: string, locale: Locale): Promise<OwnerSteps | null> {
  const [eras, places, snapshots, polities, worldEvents, glossary, registry, themes] = await Promise.all([
    repo.listEras(),
    repo.listPlaces(),
    repo.listTerritorySnapshots(),
    repo.listPolities(),
    repo.listWorldEvents(),
    repo.getGlossary(),
    repo.getRegistry(),
    repo.listThemes(),
  ]);
  const polityColors = Object.fromEntries(polities.map((p) => [p.id, p.color]));
  const href = entityPath(type, id) ?? "/";
  const pack = (name: Parameters<typeof t>[0], shell: ShellStep[], raw: RawStep[], used: ThemeMap): OwnerSteps => ({
    owner: { type, id, name: t(name, locale), href },
    steps: new Map(shell.map((s, i) => [s.id, { shell: s, raw: raw[i]! }])),
    themes: used,
  });

  if (type === "person") {
    const [person, events] = await Promise.all([repo.getPerson(id), repo.getEvents(id)]);
    if (!person || !events.length) return null;
    const journey = buildJourney(person, events, eras, { places, snapshots, polityColors, worldEvents, glossary, registry, political: EMPTY_POLITICAL, themes });
    return pack(person.name, personSteps(journey, locale), journey.steps.map((s) => s.event), journey.themes);
  }
  if (type === "state") {
    const [state, stages] = await Promise.all([repo.getState(id), repo.getStateSteps(id)]);
    if (!state || !stages.length) return null;
    const sim = buildStateSimulation(state, stages, { eras, places, snapshots, polityColors, worldEvents, glossary, registry, political: EMPTY_POLITICAL, themes });
    return pack(state.name, stateSteps(sim, locale), sim.steps.map((s) => s.stage), sim.themes);
  }
  const [conflict, days, extras] = await Promise.all([repo.getConflict(id), repo.getConflictDays(id), repo.getConflictExtras(id)]);
  if (!conflict || !days.length) return null;
  const sim = buildConflictSimulation(conflict, days, { eras, places, snapshots, polityColors, glossary, registry, political: EMPTY_POLITICAL, themes, ...extras });
  return pack(conflict.name, conflictSteps(sim, locale), sim.steps.map((s) => s.day), sim.themes);
}

export interface TopicLabels {
  /** "8-ci sinif" */
  grade: string;
  final: string;
}

export interface TopicSimulation {
  shell: ShellData;
  deck: QuizQuestion[];
  owners: StepOwner[];
  /** Theme of the last step, for the final screen. */
  themeId: string;
  /** Index of the last step that is not a legend: reaching it finishes the topic even with legends hidden. */
  lastIndex: number;
}

/** The topic as a simulation; null when none of its steps exists (a topic "hazırlanır"). */
export async function buildTopic(
  repo: HistoryRepository,
  grade: CurriculumGrade,
  topic: CurriculumTopic,
  locale: Locale,
  labels: TopicLabels,
): Promise<TopicSimulation | null> {
  const ownerKeys = [...new Map(topic.steps.map((r) => [`${r.type}:${r.id}`, r])).values()];
  const loaded = new Map<string, OwnerSteps>();
  await Promise.all(
    ownerKeys.map(async (r) => {
      const o = await ownerSteps(repo, r.type, r.id, locale);
      if (o) loaded.set(`${r.type}:${r.id}`, o);
    }),
  );

  const picked: { ref: TopicStepRef; owner: StepOwner; shell: ShellStep; raw: RawStep }[] = [];
  for (const ref of topic.steps) {
    const o = loaded.get(`${ref.type}:${ref.id}`);
    const s = o?.steps.get(ref.stepId);
    if (o && s) picked.push({ ref, owner: o.owner, ...s });
  }
  if (!picked.length) return null;

  // Ids stay the data's step ids (deep links, quiz links); a clash between two simulations gets the owner as prefix.
  const seen = new Set<string>();
  const steps: ShellStep[] = picked.map(({ ref, owner, shell }, index) => {
    const id = seen.has(shell.id) ? `${ref.id}-${shell.id}` : shell.id;
    seen.add(id);
    return { ...shell, id, index, owner: { type: owner.type, id: owner.id, name: owner.name, stepKey: ref.stepId, href: entityPath(owner.type, owner.id, ref.stepId) ?? owner.href } };
  });

  const years = steps.map((s) => s.year);
  const from = Math.min(...years);
  const to = Math.max(...years);
  const [places, snapshots, glossary, political] = await Promise.all([
    repo.listPlaces(),
    repo.listTerritorySnapshots(),
    repo.getGlossary(),
    loadPoliticalContext(repo, from, to),
  ]);
  const themes: ThemeMap = Object.assign({}, ...[...loaded.values()].map((o) => o.themes));
  const c = adapterContext(locale, glossary, themes);
  const frame = shellFrame({ places: [], landmarks: placesForSpan(places, from, to), snapshots, political }, steps, c);

  // Places of the topic, in the order the topic reaches them.
  const shellPlaces = new Map<string, ShellPlace>();
  for (const s of steps) {
    const key = `${s.center[1].toFixed(2)},${s.center[0].toFixed(2)}`;
    if (!shellPlaces.has(key)) shellPlaces.set(key, { key, name: shortPlace(s.placeName), center: s.center, firstStep: s.index, placeId: s.placeId });
  }

  const gradeLabel = labels.grade;
  const key = `topic:${topic.id}`;
  const shell: ShellData = {
    key,
    kind: "topic",
    title: t(topic.title, locale),
    subtitle: [gradeLabel, topic.paragraph].filter(Boolean).join(" · "),
    back: { href: `/kurikulum/${grade.grade}/`, label: gradeLabel },
    final: { href: `${topicPath(grade.grade, topic.id)}final/`, label: labels.final },
    steps,
    ...frame,
    places: [...shellPlaces.values()],
    land: landOutline(),
  };

  const tr = c.tr;
  const deck = buildDeck({
    steps: steps.map((s, i) => ({
      id: s.id,
      index: s.index,
      title: s.title,
      year: s.year,
      yearLabel: picked[i]!.raw.date.certainty === "exact" ? String(s.year) : `~${s.year}`,
      place: shortPlace(s.placeName),
      center: s.center,
    })),
    questions: picked.flatMap(({ raw, owner }, i) =>
      (raw.quiz ?? []).map((q, questionIndex) => ({
        stepId: steps[i]!.id,
        questionIndex,
        question: tr(q.question),
        options: q.options.map(tr),
        correct: q.correctIndex,
        explanation: tr(q.explanation),
        owner: `${owner.type}:${owner.id}`,
        stepKey: steps[i]!.owner!.stepKey,
      })),
    ),
    claims: picked.flatMap(({ raw }, i) =>
      (raw.claims ?? [])
        .filter((cl) => cl.claimType !== "literary")
        .map((cl) => ({
          id: cl.id,
          stepId: steps[i]!.id,
          statement: tr(cl.text),
          answer: cl.claimType as "fact" | "disputed" | "legend",
          explanation: cl.why ? tr(cl.why) : null,
          source: (cl.firstRecorded?.source ?? cl.sources[0] ?? cl.versions?.[0]?.sources[0])?.title ?? null,
        })),
    ),
  });

  const owners: StepOwner[] = [];
  for (const p of picked) if (!owners.some((o) => o.type === p.owner.type && o.id === p.owner.id)) owners.push(p.owner);
  let lastIndex = steps.length - 1;
  while (lastIndex > 0 && steps[lastIndex]!.claimType === "legend") lastIndex--;
  return { shell, deck, owners, themeId: steps.at(-1)!.themeId, lastIndex };
}

/** The topic after this one in the grade that can be opened, across sections. */
export async function nextTopic(repo: HistoryRepository, grade: CurriculumGrade, topicId: string, locale: Locale) {
  const inGrade = (await allTopics(repo, grade.subject)).filter((x) => x.grade.grade === grade.grade);
  const at = inGrade.findIndex((x) => x.topic.id === topicId);
  const next = inGrade.slice(at + 1).find((x) => x.topic.steps.length > 0);
  return next ? { id: next.topic.id, title: t(next.topic.title, locale), paragraph: next.topic.paragraph ?? null, href: topicPath(grade.grade, next.topic.id) } : null;
}

