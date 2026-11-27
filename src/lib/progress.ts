"use client";

import { createStore } from "./store";

export interface PersonProgress {
  index: number;
  phase: "journey" | "legacy";
  choices: Record<string, number>;
  /** Highest stage index ever reached. */
  furthest: number;
  completed: boolean;
  updatedAt: number;
}

export interface Collection {
  /** "Tarixi kart" earned by finishing a person's life. */
  cards: Record<string, { earnedAt: number }>;
  /** Badge for a perfect quiz score, per person. */
  quizBadges: Record<string, { earnedAt: number; score: number; total: number }>;
}

/** Best result of a final quiz, per simulation or curriculum topic ("topic:<slug>"). */
export interface QuizResult {
  score: number;
  total: number;
  at: number;
}

interface ProgressState {
  persons: Record<string, PersonProgress>;
  collection: Collection;
  quizzes: Record<string, QuizResult>;
}

const EMPTY: ProgressState = { persons: {}, collection: { cards: {}, quizBadges: {} }, quizzes: {} };

function sanitizeQuizzes(raw: unknown): Record<string, QuizResult> {
  const out: Record<string, QuizResult> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, q] of Object.entries(raw as Record<string, Partial<QuizResult>>)) {
    if (!q || typeof q.score !== "number" || typeof q.total !== "number" || q.total <= 0) continue;
    out[key] = { score: Math.max(0, Math.min(q.total, Math.floor(q.score))), total: Math.floor(q.total), at: typeof q.at === "number" ? q.at : 0 };
  }
  return out;
}

function sanitize(raw: unknown): ProgressState {
  const r = raw as Partial<ProgressState> | null;
  if (!r || typeof r !== "object") return EMPTY;
  const persons: Record<string, PersonProgress> = {};
  for (const [id, p] of Object.entries(r.persons ?? {})) {
    if (!p || typeof p.index !== "number") continue;
    persons[id] = {
      index: Math.max(0, Math.floor(p.index)),
      phase: p.phase === "legacy" ? "legacy" : "journey",
      choices: typeof p.choices === "object" && p.choices ? p.choices : {},
      furthest: typeof p.furthest === "number" ? p.furthest : p.index,
      completed: !!p.completed,
      updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : 0,
    };
  }
  return {
    persons,
    collection: {
      cards: r.collection?.cards ?? {},
      quizBadges: r.collection?.quizBadges ?? {},
    },
    quizzes: sanitizeQuizzes(r.quizzes),
  };
}

export const progressStore = createStore<ProgressState>("tarix:progress", EMPTY, sanitize);
export const useProgress = progressStore.useValue;

export function saveProgress(personId: string, patch: Omit<PersonProgress, "furthest" | "completed" | "updatedAt">, stepCount: number) {
  progressStore.set((s) => {
    const prev = s.persons[personId];
    const reachedEnd = patch.phase === "legacy";
    const furthest = Math.max(prev?.furthest ?? 0, reachedEnd ? stepCount - 1 : patch.index);
    const completed = (prev?.completed ?? false) || reachedEnd;
    const cards = completed && !s.collection.cards[personId]
      ? { ...s.collection.cards, [personId]: { earnedAt: Date.now() } }
      : s.collection.cards;
    return {
      ...s,
      persons: { ...s.persons, [personId]: { ...patch, furthest, completed, updatedAt: Date.now() } },
      collection: { ...s.collection, cards },
    };
  });
}

/** Keeps the best result of a final quiz; a perfect score also earns the badge. */
export function recordQuiz(personId: string, score: number, total: number) {
  if (total === 0) return;
  progressStore.set((s) => {
    const best = s.quizzes[personId];
    const quizzes = !best || score / total > best.score / best.total ? { ...s.quizzes, [personId]: { score, total, at: Date.now() } } : s.quizzes;
    const badge = score >= total && !s.collection.quizBadges[personId];
    return {
      ...s,
      quizzes,
      collection: badge ? { ...s.collection, quizBadges: { ...s.collection.quizBadges, [personId]: { earnedAt: Date.now(), score, total } } } : s.collection,
    };
  });
}

export function clearProgress(personId: string) {
  progressStore.set((s) => {
    const persons = { ...s.persons };
    const kept = persons[personId];
    // The earned card stays: restarting is not losing.
    if (kept) persons[personId] = { ...kept, index: 0, phase: "journey", choices: {}, updatedAt: Date.now() };
    return { ...s, persons };
  });
}
