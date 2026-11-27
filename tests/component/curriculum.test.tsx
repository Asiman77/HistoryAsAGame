import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { GradeData, TopicCardData } from "@/features/curriculum/data";
import { GradeScreen } from "@/features/curriculum/GradeScreen";
import { progressStore, recordQuiz } from "@/lib/progress";
import { prefs } from "@/stores/prefs";
import { renderAz } from "./render";

/** Sample grade (not historical content): only the structure matters here. */
const topic = (id: string, number: number, over: Partial<TopicCardData> = {}): TopicCardData => ({
  id,
  number,
  title: `Nümunə ${id}`,
  paragraph: `§ ${number}`,
  summary: null,
  minutes: 10,
  steps: 4,
  ready: true,
  years: { from: 1500, to: 1514 },
  owners: ["Nümunə şəxs"],
  href: `/kurikulum/8/${id}/`,
  ...over,
});

const grade: GradeData = {
  subject: "azerbaijan-history",
  grade: 8,
  title: "Nümunə",
  textbook: null,
  sample: true,
  sections: [
    { id: "s1", number: 1, title: "Bölmə bir", topics: [topic("a", 1), topic("b", 2)] },
    { id: "s2", number: 2, title: "Bölmə iki", topics: [topic("c", 1), topic("d", 2, { ready: false, steps: 0, owners: [], years: null })] },
  ],
};

const rows = () => screen.getAllByTestId("topic-row");

describe("GradeScreen", () => {
  beforeEach(() => {
    progressStore.set(progressStore.defaults);
    prefs.set(prefs.defaults);
  });

  it("marks the sample and lists the topics of the first section as new", () => {
    renderAz(<GradeScreen data={grade} />);
    expect(screen.getByTestId("sample-notice")).toBeInTheDocument();
    expect(rows().map((r) => r.getAttribute("data-status"))).toEqual(["new", "new"]);
    expect(within(rows()[0]!).getByTestId("topic-meta")).toHaveTextContent("§ 1 · 4 mərhələ · ≈ 10 dəqiqə · Nümunə şəxs simulyasiyası ilə");
    expect(within(rows()[0]!).getByRole("link", { name: "Başla: Nümunə a" })).toHaveAttribute("href", "/kurikulum/8/a/");
  });

  it("shows progress, the quiz result, and topics being prepared without a link", () => {
    act(() => {
      progressStore.set((s) => ({
        ...s,
        persons: {
          "topic:a": { index: 3, phase: "legacy", choices: {}, furthest: 3, completed: true, updatedAt: 1 },
          "topic:b": { index: 1, phase: "journey", choices: {}, furthest: 1, completed: false, updatedAt: 1 },
        },
      }));
      recordQuiz("topic:a", 5, 6);
    });
    renderAz(<GradeScreen data={grade} />);
    expect(rows().map((r) => r.getAttribute("data-status"))).toEqual(["done", "progress"]);
    expect(within(rows()[0]!).getByTestId("topic-meta")).toHaveTextContent("quiz: 5/6");
    expect(within(rows()[0]!).getByRole("link")).toHaveTextContent("Təkrarla");
    expect(within(rows()[1]!).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");

    fireEvent.click(screen.getAllByTestId("section-button")[1]!);
    expect(rows().map((r) => r.getAttribute("data-status"))).toEqual(["new", "preparing"]);
    expect(within(rows()[1]!).queryByRole("link")).toBeNull();
    expect(rows()[1]).toHaveTextContent("hazırlanır");
    expect(rows()[1]).toHaveTextContent("Tezliklə");
  });

  it("opens the first section with work left", () => {
    act(() => {
      progressStore.set((s) => ({
        ...s,
        persons: Object.fromEntries(["a", "b"].map((id) => [`topic:${id}`, { index: 3, phase: "legacy" as const, choices: {}, furthest: 3, completed: true, updatedAt: 1 }])),
      }));
    });
    renderAz(<GradeScreen data={grade} />);
    expect(screen.getAllByTestId("section-button")[1]).toHaveAttribute("aria-current", "true");
    expect(rows()[0]).toHaveAttribute("data-topic", "c");
  });

  it("takes a class code, refuses a wrong one and forgets it on request", () => {
    renderAz(<GradeScreen data={grade} />);
    fireEvent.click(screen.getByTestId("class-code-open"));
    const input = screen.getByRole("textbox", { name: "Kod" });
    fireEvent.change(input, { target: { value: "k7mq2" } });
    fireEvent.click(screen.getByRole("button", { name: "Yadda saxla" }));
    expect(screen.getByRole("alert")).toHaveTextContent("6 simvol");
    expect(prefs.get().classCode).toBeNull();
    fireEvent.change(input, { target: { value: "k7mq2x" } });
    fireEvent.click(screen.getByRole("button", { name: "Yadda saxla" }));
    expect(prefs.get().classCode).toBe("K7MQ2X");
    expect(screen.getByTestId("class-code")).toHaveTextContent("Sinif kodu: K7MQ2X");
    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    expect(prefs.get().classCode).toBeNull();
    expect(screen.getByTestId("class-code-open")).toBeInTheDocument();
  });
});

describe("quiz results", () => {
  it("keep the best score and a badge for a perfect one", () => {
    progressStore.set(progressStore.defaults);
    recordQuiz("topic:x", 4, 6);
    recordQuiz("topic:x", 3, 6);
    expect(progressStore.get().quizzes["topic:x"]).toMatchObject({ score: 4, total: 6 });
    expect(progressStore.get().collection.quizBadges["topic:x"]).toBeUndefined();
    recordQuiz("topic:x", 6, 6);
    expect(progressStore.get().quizzes["topic:x"]).toMatchObject({ score: 6, total: 6 });
    expect(progressStore.get().collection.quizBadges["topic:x"]).toBeDefined();
  });
});
