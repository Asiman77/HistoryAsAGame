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

interface ProgressState {
  persons: Record<string, PersonProgress>;
  collection: Collection;
}

const EMPTY: ProgressState = { persons: {}, collection: { cards: {}, quizBadges: {} } };

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
      persons: { ...s.persons, [personId]: { ...patch, furthest, completed, updatedAt: Date.now() } },
      collection: { ...s.collection, cards },
    };
  });
}

export function recordQuiz(personId: string, score: number, total: number) {
  if (total === 0 || score < total) return;
  progressStore.set((s) =>
    s.collection.quizBadges[personId]
      ? s
      : { ...s, collection: { ...s.collection, quizBadges: { ...s.collection.quizBadges, [personId]: { earnedAt: Date.now(), score, total } } } },
  );
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
