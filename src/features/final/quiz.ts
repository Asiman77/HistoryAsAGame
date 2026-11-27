/**
 * The final quiz (FRONTEND_SPEC §6.9): four kinds of question, all built
 * from the simulation's own data at build time, never written by hand.
 *  - choice: the multiple-choice questions of the steps (data `quiz`)
 *  - claim:  "Fakt yoxsa rəvayət?" on the classified statements (data `claims`)
 *  - order:  put four steps in chronological order
 *  - map:    find the place of the story among a few unlabelled points
 * Selection is deterministic, so the static page and the browser agree and a
 * class sees the same questions. Grading is pure and unit-tested.
 */
import { pickRound } from "@/lib/claims";

export type QuizKind = "choice" | "claim" | "order" | "map";
export type ClaimAnswer = "fact" | "disputed" | "legend";
export const CLAIM_ANSWERS: readonly ClaimAnswer[] = ["fact", "disputed", "legend"];

/** [lng, lat] */
type LngLat = [number, number];

/** The step an answer sends the student back to. */
export interface QuizStepRef {
  id: string;
  /** 1-based position in the simulation ("Mərhələ 7"). */
  number: number;
  title: string;
}

interface Base {
  id: string;
  kind: QuizKind;
  step: QuizStepRef | null;
}

export interface ChoiceQuestion extends Base {
  kind: "choice";
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  /** Analytics: which step quiz and which question in it (ADR-0020). */
  stepKey: string;
  questionIndex: number;
  /** Simulation of the step ("person:shah-ismayil") when the deck mixes several (curriculum topics). */
  owner?: string;
}

export interface ClaimQuestion extends Base {
  kind: "claim";
  statement: string;
  correct: ClaimAnswer;
  /** Why it is classified so; null → the generic help text of the kind. */
  explanation: string | null;
  source: string | null;
}

export interface OrderQuestion extends Base {
  kind: "order";
  /** Shown in this (shuffled) order; `index` is the step index. */
  events: { id: string; title: string; yearLabel: string }[];
  /** Ids in chronological order. */
  correct: string[];
}

export interface MapQuestion extends Base {
  kind: "map";
  place: string;
  /** The step that happened there, for the explanation. */
  context: string;
  /** Points in [lng, lat]; letters A, B, C… follow this order. */
  options: { id: string; center: LngLat; name: string }[];
  correct: string;
}

export type QuizQuestion = ChoiceQuestion | ClaimQuestion | OrderQuestion | MapQuestion;

export type QuizAnswer<Q extends QuizQuestion = QuizQuestion> = Q extends ChoiceQuestion
  ? number
  : Q extends ClaimQuestion
    ? ClaimAnswer
    : Q extends OrderQuestion
      ? string[]
      : string;

export interface DeckStep {
  id: string;
  index: number;
  title: string;
  year: number;
  /** "1501" or "~1501". */
  yearLabel: string;
  /** Short place name ("Lahican"). */
  place: string;
  center: LngLat;
}

export interface DeckInput {
  steps: DeckStep[];
  questions: { stepId: string; questionIndex: number; question: string; options: string[]; correct: number; explanation: string; owner?: string; stepKey?: string }[];
  claims: { id: string; stepId: string; statement: string; answer: ClaimAnswer; explanation: string | null; source: string | null }[];
}

export const DECK_SIZE = 6;
const ORDER_SIZE = 4;
const MAP_OPTIONS = 4;
/** Map points closer than this (km) would overlap on the small map. */
const MAP_MIN_KM = 140;

/** Kinds take turns so the quiz never asks the same kind twice in a row when it can help it. */
const SLOTS: QuizKind[] = ["choice", "claim", "order", "choice", "map", "claim", "choice", "choice"];

function km([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Deterministic pseudo-random sequence (same as the claims round). */
function seeded(seed: number) {
  let x = seed;
  return () => (x = (x * 9301 + 49297) % 233280) / 233280;
}

/** `n` items spread evenly over the list (the beginning, the middle and the end of a life). */
export function spread<T>(all: T[], n: number): T[] {
  if (all.length <= n) return all;
  const step = all.length / n;
  return Array.from({ length: n }, (_, i) => all[Math.floor(i * step + step / 2)]!);
}

const refOf = (s: DeckStep | undefined): QuizStepRef | null => (s ? { id: s.id, number: s.index + 1, title: s.title } : null);

/** Four steps with different years, spread over the life, shown shuffled (never already in order). */
export function orderQuestion(steps: DeckStep[], seed = 1): OrderQuestion | null {
  const distinct: DeckStep[] = [];
  for (const s of steps) if (!distinct.some((d) => d.year === s.year)) distinct.push(s);
  if (distinct.length < ORDER_SIZE) return null;
  const picked = spread(distinct, ORDER_SIZE).sort((a, b) => a.year - b.year || a.index - b.index);
  const rand = seeded(seed + 7);
  const shown = [...picked].sort(() => rand() - 0.5);
  if (shown.every((s, i) => s.id === picked[i]!.id)) shown.push(shown.shift()!);
  return {
    id: `order:${picked.map((s) => s.id).join(",")}`,
    kind: "order",
    step: null,
    events: shown.map((s) => ({ id: s.id, title: s.title, yearLabel: s.yearLabel })),
    correct: picked.map((s) => s.id),
  };
}

/**
 * The place the story returns to most often, among three others of the
 * story far enough apart to tell on a small map. The nearest such places are
 * preferred, so the map stays regional and the question is not trivial.
 */
export function mapQuestion(steps: DeckStep[]): MapQuestion | null {
  const places = new Map<string, { name: string; center: LngLat; steps: DeckStep[] }>();
  for (const s of steps) {
    const p = places.get(s.place);
    if (p) p.steps.push(s);
    else places.set(s.place, { name: s.place, center: s.center, steps: [s] });
  }
  const all = [...places.values()];
  if (all.length < MAP_OPTIONS) return null;
  const target = [...all].sort((a, b) => b.steps.length - a.steps.length || a.steps[0]!.index - b.steps[0]!.index)[0]!;
  const chosen = [target];
  for (const p of [...all].sort((a, b) => km(a.center, target.center) - km(b.center, target.center))) {
    if (chosen.length >= MAP_OPTIONS) break;
    if (chosen.every((c) => km(c.center, p.center) >= MAP_MIN_KM)) chosen.push(p);
  }
  if (chosen.length < MAP_OPTIONS) return null;
  // Letters by longitude (west to east): stable and unrelated to the answer.
  const options = chosen
    .sort((a, b) => a.center[0] - b.center[0])
    .map((p, i) => ({ id: `p${i}`, center: p.center, name: p.name }));
  const correct = options.find((o) => o.name === target.name)!.id;
  const first = target.steps[0]!;
  return {
    id: `map:${target.name}`,
    kind: "map",
    step: refOf(first),
    place: target.name,
    context: `${first.title}, ${first.yearLabel}`,
    options,
    correct,
  };
}

/** The deck of the final quiz: at most DECK_SIZE questions, kinds taking turns. */
export function buildDeck(input: DeckInput, size = DECK_SIZE): QuizQuestion[] {
  const stepOf = (id: string) => input.steps.find((s) => s.id === id);
  const pools: Record<QuizKind, QuizQuestion[]> = {
    choice: spread(input.questions, 4).map((q) => ({
      id: `choice:${q.stepId}:${q.questionIndex}`,
      kind: "choice",
      step: refOf(stepOf(q.stepId)),
      question: q.question,
      options: q.options,
      correct: q.correct,
      explanation: q.explanation,
      stepKey: q.stepKey ?? q.stepId,
      questionIndex: q.questionIndex,
      ...(q.owner ? { owner: q.owner } : {}),
    })),
    claim: pickRound(input.claims, 2).map((c) => ({
      id: `claim:${c.id}`,
      kind: "claim",
      step: refOf(stepOf(c.stepId)),
      statement: c.statement,
      correct: c.answer,
      explanation: c.explanation,
      source: c.source,
    })),
    order: [orderQuestion(input.steps)].filter((q): q is OrderQuestion => !!q),
    map: [mapQuestion(input.steps)].filter((q): q is MapQuestion => !!q),
  };
  const deck: QuizQuestion[] = [];
  for (const kind of SLOTS) {
    if (deck.length >= size) break;
    const q = pools[kind].shift();
    if (q) deck.push(q);
  }
  return deck;
}

/** Is the answer right? */
export function grade(q: QuizQuestion, answer: QuizAnswer): boolean {
  switch (q.kind) {
    case "choice":
      return answer === q.correct;
    case "claim":
      return answer === q.correct;
    case "map":
      return answer === q.correct;
    case "order": {
      const ids = answer as string[];
      return ids.length === q.correct.length && ids.every((id, i) => id === q.correct[i]);
    }
  }
}

export interface QuizScore {
  score: number;
  total: number;
  perfect: boolean;
  /** great ≥ 80 %, good ≥ 50 %, otherwise low. */
  level: "great" | "good" | "low";
}

export function scoreOf(results: boolean[]): QuizScore {
  const score = results.filter(Boolean).length;
  const total = results.length;
  const ratio = total ? score / total : 0;
  return { score, total, perfect: total > 0 && score === total, level: ratio >= 0.8 ? "great" : ratio >= 0.5 ? "good" : "low" };
}
