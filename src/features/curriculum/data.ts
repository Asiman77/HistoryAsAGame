/**
 * The school curriculum at build time (FRONTEND_SPEC §6.3): grades, sections
 * and topics from data/curriculum, resolved for the page's locale. Topic and
 * section names come only from the data; without data the pages show their
 * empty state. `CURRICULUM_SAMPLE=1` adds the sample grade of fixtures/ (marked
 * "nümunə") to show the whole flow before real curriculum data exists.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { entityPath } from "@/domain/registry";
import { CurriculumGrade, DEFAULT_SUBJECT, type CurriculumTopic, type Locale, type TopicStepRef } from "@/domain/schema";
import type { HistoryRepository } from "@/data/repository";
import { t } from "@/lib/i18n";

export const SAMPLE_FILE = path.join("fixtures", "curriculum.sample.json");

/** The sample grade is built in only when asked for (tests, screenshots, demos). */
export const sampleEnabled = () => process.env.CURRICULUM_SAMPLE === "1";

let sample: Promise<CurriculumGrade> | undefined;

export function loadSampleGrade(): Promise<CurriculumGrade> {
  sample ??= readFile(path.join(process.cwd(), SAMPLE_FILE), "utf8").then((s) => CurriculumGrade.parse(JSON.parse(s)));
  return sample;
}

/** Grades of a subject in order; the sample grade joins them only with CURRICULUM_SAMPLE=1 and never replaces real data. */
export async function curriculumGrades(repo: HistoryRepository, subject = DEFAULT_SUBJECT): Promise<CurriculumGrade[]> {
  const real = await repo.listCurriculum(subject);
  if (!sampleEnabled()) return real;
  const s = await loadSampleGrade();
  if (s.subject !== subject || real.some((g) => g.grade === s.grade)) return real;
  return [...real, s].sort((a, b) => a.grade - b.grade);
}

export type OwnerType = TopicStepRef["type"];

/** The simulation a topic step belongs to. */
export interface StepOwner {
  type: OwnerType;
  id: string;
  name: string;
  href: string;
}

/** Where each step of the data lives and when it happened ("person:shah-ismayil:ismayil-coronation" → …). */
export type StepCatalogue = Map<string, { owner: StepOwner; year: number }>;

export const stepKey = (r: Pick<TopicStepRef, "type" | "id" | "stepId">) => `${r.type}:${r.id}:${r.stepId}`;

/** Steps of the simulations the given topics name, with their owners; unknown steps are simply absent. */
export async function stepCatalogue(repo: HistoryRepository, refs: readonly TopicStepRef[], locale: Locale): Promise<StepCatalogue> {
  const out: StepCatalogue = new Map();
  const owners = new Map<string, TopicStepRef>();
  for (const r of refs) owners.set(`${r.type}:${r.id}`, r);
  await Promise.all(
    [...owners.values()].map(async ({ type, id }) => {
      let name: Parameters<typeof t>[0] | undefined;
      let steps: { id: string; date: { year: number } }[] = [];
      if (type === "person") {
        const [p, events] = await Promise.all([repo.getPerson(id), repo.getEvents(id)]);
        name = p?.name;
        steps = events;
      } else if (type === "state") {
        const [s, stages] = await Promise.all([repo.getState(id), repo.getStateSteps(id)]);
        name = s?.name;
        steps = stages;
      } else {
        const [c, days] = await Promise.all([repo.getConflict(id), repo.getConflictDays(id)]);
        name = c?.name;
        steps = days;
      }
      if (!name) return;
      const owner: StepOwner = { type, id, name: t(name, locale), href: entityPath(type, id) ?? "/" };
      for (const s of steps) out.set(stepKey({ type, id, stepId: s.id }), { owner, year: s.date.year });
    }),
  );
  return out;
}

export interface TopicCardData {
  id: string;
  /** 1-based position in its section, shown in the status tile. */
  number: number;
  title: string;
  /** "§ 12" as the textbook prints it. */
  paragraph: string | null;
  summary: string | null;
  minutes: number | null;
  steps: number;
  /** Has steps and every one of them exists: the topic can be opened. Otherwise "hazırlanır". */
  ready: boolean;
  years: { from: number; to: number } | null;
  /** Simulations the steps come from, in order of first appearance ("Şah İsmayıl simulyasiyası ilə"). */
  owners: string[];
  href: string;
}

export interface SectionData {
  id: string;
  number: number;
  title: string;
  topics: TopicCardData[];
}

export interface GradeData {
  subject: string;
  grade: number;
  title: string;
  textbook: { title: string; authors: string; year: number; publisher: string | null; url: string | null } | null;
  sample: boolean;
  sections: SectionData[];
}

export const topicPath = (grade: number, topicId: string) => `/kurikulum/${grade}/${topicId}/`;

function topicCard(grade: number, topic: CurriculumTopic, number: number, steps: StepCatalogue, locale: Locale): TopicCardData {
  const found = topic.steps.map((r) => steps.get(stepKey(r))).filter((s) => !!s);
  const years = found.map((s) => s.year);
  const owners: string[] = [];
  for (const s of found) if (!owners.includes(s.owner.name)) owners.push(s.owner.name);
  return {
    id: topic.id,
    number,
    title: t(topic.title, locale),
    paragraph: topic.paragraph ?? null,
    summary: topic.summary ? t(topic.summary, locale) : null,
    minutes: topic.minutes ?? null,
    steps: topic.steps.length,
    ready: topic.steps.length > 0 && found.length === topic.steps.length,
    years: years.length ? { from: Math.min(...years), to: Math.max(...years) } : null,
    owners,
    href: topicPath(grade, topic.id),
  };
}

export function gradeData(g: CurriculumGrade, steps: StepCatalogue, locale: Locale): GradeData {
  return {
    subject: g.subject,
    grade: g.grade,
    title: t(g.title, locale),
    textbook: g.textbook
      ? { title: t(g.textbook.title, locale), authors: g.textbook.authors, year: g.textbook.year, publisher: g.textbook.publisher ?? null, url: g.textbook.url ?? null }
      : null,
    sample: !!g.sample,
    sections: g.sections.map((s, i) => ({
      id: s.id,
      number: i + 1,
      title: t(s.title, locale),
      topics: s.topics.map((topic, j) => topicCard(g.grade, topic, j + 1, steps, locale)),
    })),
  };
}

/** A grade of the subject ready for its page, or null when the data has none. */
export async function loadGrade(repo: HistoryRepository, grade: number, locale: Locale, subject = DEFAULT_SUBJECT): Promise<GradeData | null> {
  const g = (await curriculumGrades(repo, subject)).find((x) => x.grade === grade);
  if (!g) return null;
  const refs = g.sections.flatMap((s) => s.topics.flatMap((topic) => topic.steps));
  return gradeData(g, await stepCatalogue(repo, refs, locale), locale);
}

/** A topic of a grade, or null. */
export async function findTopic(repo: HistoryRepository, grade: number, topicId: string, subject = DEFAULT_SUBJECT) {
  return (await allTopics(repo, subject)).find((x) => x.grade.grade === grade && x.topic.id === topicId) ?? null;
}

/**
 * Static params of the topic routes: every topic with steps. A static export needs at least one page
 * per dynamic route, so without curriculum data a placeholder renders the not-found page.
 */
export const TOPIC_PLACEHOLDER = { grade: "8", topic: "movzu-hazirlanir" };

export async function topicParams(repo: HistoryRepository, subject = DEFAULT_SUBJECT): Promise<{ grade: string; topic: string }[]> {
  const out = (await allTopics(repo, subject)).filter((x) => x.topic.steps.length > 0).map((x) => ({ grade: String(x.grade.grade), topic: x.topic.id }));
  return out.length ? out : [TOPIC_PLACEHOLDER];
}

/** Every topic of the subject with its grade, for static params and "Növbəti mövzu". */
export async function allTopics(repo: HistoryRepository, subject = DEFAULT_SUBJECT) {
  return (await curriculumGrades(repo, subject)).flatMap((g) =>
    g.sections.flatMap((section) => section.topics.map((topic) => ({ grade: g, section, topic }))),
  );
}
