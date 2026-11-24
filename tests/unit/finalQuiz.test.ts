import { describe, expect, it } from "vitest";
import {
  buildDeck,
  grade,
  mapQuestion,
  orderQuestion,
  scoreOf,
  spread,
  type DeckInput,
  type DeckStep,
  type OrderQuestion,
} from "@/features/final/quiz";

const step = (i: number, year: number, place: string, center: [number, number]): DeckStep => ({
  id: `s${i}`,
  index: i,
  title: `Step ${i}`,
  year,
  yearLabel: String(year),
  place,
  center,
});

/** A made-up life (test fixture, not history): places a few hundred km apart. */
const steps: DeckStep[] = [
  step(0, 1487, "A", [48.3, 38.25]),
  step(1, 1488, "A", [48.3, 38.25]),
  step(2, 1494, "B", [50.0, 37.2]),
  step(3, 1499, "A", [48.3, 38.25]),
  step(4, 1500, "C", [39.5, 39.75]),
  step(5, 1501, "D", [46.3, 38.07]),
  step(6, 1501, "D", [46.3, 38.07]),
  step(7, 1508, "E", [44.4, 33.3]),
  step(8, 1514, "F", [44.0, 39.1]),
  step(9, 1524, "D", [46.3, 38.07]),
];

const input: DeckInput = {
  steps,
  questions: Array.from({ length: 7 }, (_, i) => ({
    stepId: `s${i}`,
    questionIndex: 0,
    question: `Q${i}`,
    options: ["x", "y", "z"],
    correct: i % 3,
    explanation: `E${i}`,
  })),
  claims: [
    { id: "c1", stepId: "s2", statement: "one", answer: "fact", explanation: null, source: null },
    { id: "c2", stepId: "s3", statement: "two", answer: "legend", explanation: "why", source: "src" },
    { id: "c3", stepId: "s8", statement: "three", answer: "disputed", explanation: null, source: null },
  ],
};

describe("final quiz deck", () => {
  it("mixes the four kinds and never repeats a question", () => {
    const deck = buildDeck(input);
    expect(deck).toHaveLength(6);
    expect(new Set(deck.map((q) => q.kind))).toEqual(new Set(["choice", "claim", "order", "map"]));
    expect(new Set(deck.map((q) => q.id)).size).toBe(deck.length);
    for (let i = 1; i < deck.length; i++) expect(deck[i]!.kind).not.toBe(deck[i - 1]!.kind);
  });

  it("is deterministic, so the static page and the browser agree", () => {
    expect(buildDeck(input)).toEqual(buildDeck(input));
  });

  it("goes on with the kinds it has when data for one is missing", () => {
    const deck = buildDeck({ ...input, claims: [] });
    expect(deck.some((q) => q.kind === "claim")).toBe(false);
    expect(deck.length).toBeGreaterThanOrEqual(5);
  });

  it("links each question to the step to look at again", () => {
    const deck = buildDeck(input);
    const choice = deck.find((q) => q.kind === "choice")!;
    expect(choice.step).toMatchObject({ id: expect.stringMatching(/^s\d$/), number: expect.any(Number) });
    expect(choice.step!.number).toBe(Number(choice.step!.id.slice(1)) + 1);
  });

  it("spreads picks over the whole list", () => {
    expect(spread([1, 2, 3, 4, 5, 6, 7, 8], 4)).toEqual([2, 4, 6, 8]);
    expect(spread([1, 2], 4)).toEqual([1, 2]);
  });
});

describe("chronology question", () => {
  it("takes four steps of different years and shows them out of order", () => {
    const q = orderQuestion(steps)!;
    expect(q.correct).toHaveLength(4);
    const years = q.correct.map((id) => steps.find((s) => s.id === id)!.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(new Set(years).size).toBe(4);
    expect(q.events.map((e) => e.id)).not.toEqual(q.correct);
    expect([...q.events.map((e) => e.id)].sort()).toEqual([...q.correct].sort());
  });

  it("is skipped when the story has fewer than four distinct years", () => {
    expect(orderQuestion(steps.slice(0, 3))).toBeNull();
  });
});

describe("find on the map", () => {
  it("asks for the place the story returns to most, among far-apart points", () => {
    const q = mapQuestion(steps)!;
    expect(q.place).toBe("A");
    expect(q.options).toHaveLength(4);
    expect(q.options.find((o) => o.id === q.correct)!.name).toBe("A");
    // Lettered west to east.
    const lngs = q.options.map((o) => o.center[0]);
    expect(lngs).toEqual([...lngs].sort((a, b) => a - b));
  });

  it("is skipped when there are not enough distinct places", () => {
    expect(mapQuestion(steps.slice(0, 3))).toBeNull();
  });
});

describe("grading", () => {
  const deck = buildDeck(input);
  it("grades every kind", () => {
    for (const q of deck) {
      switch (q.kind) {
        case "choice":
          expect(grade(q, q.correct)).toBe(true);
          expect(grade(q, (q.correct + 1) % q.options.length)).toBe(false);
          break;
        case "claim":
          expect(grade(q, q.correct)).toBe(true);
          expect(grade(q, q.correct === "fact" ? "legend" : "fact")).toBe(false);
          break;
        case "map":
          expect(grade(q, q.correct)).toBe(true);
          expect(grade(q, q.options.find((o) => o.id !== q.correct)!.id)).toBe(false);
          break;
        case "order":
          expect(grade(q, q.correct)).toBe(true);
          expect(grade(q, [...q.correct].reverse())).toBe(false);
          expect(grade(q, q.correct.slice(0, 3))).toBe(false);
          break;
      }
    }
  });

  it("an order is right only when every place is right", () => {
    const q = deck.find((x): x is OrderQuestion => x.kind === "order")!;
    const swapped = [q.correct[1]!, q.correct[0]!, ...q.correct.slice(2)];
    expect(grade(q, swapped)).toBe(false);
  });

  it("scores and rates the result", () => {
    expect(scoreOf([true, true, true, true, true])).toEqual({ score: 5, total: 5, perfect: true, level: "great" });
    expect(scoreOf([true, true, true, false, false, false])).toMatchObject({ score: 3, level: "good", perfect: false });
    expect(scoreOf([true, false, false])).toMatchObject({ level: "low" });
    expect(scoreOf([])).toEqual({ score: 0, total: 0, perfect: false, level: "low" });
  });
});
