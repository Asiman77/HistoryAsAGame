import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileSystemRepository } from "@/data/fileSystemRepository";
import { allTopics, curriculumGrades, findTopic, loadGrade, loadSampleGrade, TOPIC_PLACEHOLDER, topicParams } from "@/features/curriculum/data";
import { firstOpenSection, sectionShare, topicRow, topicShare, topicStatus } from "@/features/curriculum/status";
import { buildTopic, nextTopic } from "@/features/curriculum/topic";
import { normalizeClassCode } from "@/lib/classCode";
import type { PersonProgress } from "@/lib/progress";

const repo = new FileSystemRepository();
const labels = { grade: "8-ci sinif", final: "Yekun quiz" };
const progress = (p: Partial<PersonProgress>): PersonProgress => ({ index: 0, phase: "journey", choices: {}, furthest: 0, completed: false, updatedAt: 1, ...p });

describe("curriculum data (phase 7)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("has no grades without data, and the sample only when the build asks for it", async () => {
    expect(await curriculumGrades(repo)).toEqual([]);
    expect(await topicParams(repo)).toEqual([TOPIC_PLACEHOLDER]);
    vi.stubEnv("CURRICULUM_SAMPLE", "1");
    expect((await curriculumGrades(repo)).map((g) => g.grade)).toEqual([8]);
    expect(await curriculumGrades(repo, "world-history")).toEqual([]);
    expect(await topicParams(repo)).toEqual([
      { grade: "8", topic: "sample-agqoyunlu" },
      { grade: "8", topic: "sample-sefevi" },
      { grade: "8", topic: "sample-efshar" },
    ]);
  });

  it("a grade lists its sections and topics with steps, owners and whether they can be opened", async () => {
    vi.stubEnv("CURRICULUM_SAMPLE", "1");
    const g = (await loadGrade(repo, 8, "az"))!;
    expect(g.sample).toBe(true);
    expect(g.sections.map((s) => [s.number, s.topics.map((t) => [t.number, t.id, t.ready])])).toEqual([
      [1, [[1, "sample-agqoyunlu", true], [2, "sample-sefevi", true]]],
      [2, [[1, "sample-efshar", true], [2, "sample-preparing", false]]],
    ]);
    const efshar = g.sections[1]!.topics[0]!;
    expect(efshar).toMatchObject({ paragraph: "§ 3", steps: 4, minutes: 20, href: "/kurikulum/8/sample-efshar/", owners: ["Nadir Şah Əfşar", "Əfşarlar dövləti"] });
    expect(efshar.years).toEqual({ from: 1736, to: 1748 });
    expect(g.sections[1]!.topics[1]!.years).toBeNull();
    expect(await loadGrade(repo, 9, "az")).toBeNull();
  });

  it("a topic is told as one simulation: its steps in its own order, from several simulations", async () => {
    vi.stubEnv("CURRICULUM_SAMPLE", "1");
    const found = (await findTopic(repo, 8, "sample-efshar"))!;
    const sim = (await buildTopic(repo, found.grade, found.topic, "az", labels))!;
    const { shell } = sim;
    expect(shell).toMatchObject({ key: "topic:sample-efshar", kind: "topic", subtitle: "8-ci sinif · § 3", back: { href: "/kurikulum/8/" }, final: { href: "/kurikulum/8/sample-efshar/final/" } });
    expect(shell.steps.map((s) => [s.index, s.id, s.owner?.type, s.template])).toEqual([
      [0, "nadir-mughan", "person", "journey"],
      [1, "1739-india", "state", "territory"],
      [2, "1747-assassination", "state", "territory"],
      [3, "1748-khanates", "state", "territory"],
    ]);
    expect(shell.steps[1]!.owner).toEqual({ type: "state", id: "afshar", name: "Əfşarlar dövləti", stepKey: "1739-india", href: "/states/afshar/?step=1739-india" });
    // A person step keeps its age and portrait; a state stage has none.
    expect(shell.steps[0]!.age).not.toBeNull();
    expect(shell.steps[1]!.age).toBeNull();
    expect(shell.places.map((p) => p.firstStep)).toEqual([...new Set(shell.places.map((p) => p.firstStep))]);
    expect(shell.snapshots.every((sn) => shell.steps.some((s) => s.snapshotId === sn.id))).toBe(true);
    expect(sim.owners.map((o) => `${o.type}:${o.id}`)).toEqual(["person:nadir-shah", "state:afshar"]);
    // Choice questions report to the simulation of their step.
    const choices = sim.deck.filter((q) => q.kind === "choice");
    expect(choices.length).toBeGreaterThan(0);
    for (const q of choices) expect(q.owner).toMatch(/^(person:nadir-shah|state:afshar)$/);
  });

  it("the next topic skips the ones that are not ready and crosses sections", async () => {
    vi.stubEnv("CURRICULUM_SAMPLE", "1");
    const g = await loadSampleGrade();
    expect((await nextTopic(repo, g, "sample-sefevi", "az"))?.id).toBe("sample-efshar");
    expect(await nextTopic(repo, g, "sample-efshar", "az")).toBeNull();
    expect((await allTopics(repo)).length).toBe(4);
  });
});

describe("topic status in the grade list", () => {
  const topic = { id: "t", number: 1, title: "", paragraph: null, summary: null, minutes: null, steps: 4, ready: true, years: null, owners: [], href: "" };

  it("is done, in progress, new or preparing", () => {
    expect(topicStatus({ ready: false }, undefined)).toBe("preparing");
    expect(topicStatus(topic, undefined)).toBe("new");
    expect(topicStatus(topic, progress({ furthest: 1 }))).toBe("progress");
    expect(topicStatus(topic, progress({ completed: true }))).toBe("done");
    expect(topicShare(topic, progress({ furthest: 1 }))).toBe(0.5);
    expect(topicShare(topic, progress({ completed: true, furthest: 1 }))).toBe(1);
    expect(topicRow(topic, { "topic:t": progress({ completed: true }) }, { "topic:t": { score: 5, total: 6, at: 1 } }).quiz).toEqual({ score: 5, total: 6, at: 1 });
  });

  it("rings a section by the topics that can be opened and opens the first with work left", () => {
    const a = { id: "a", number: 1, title: "", topics: [{ ...topic, id: "x" }, { ...topic, id: "y" }] };
    const b = { id: "b", number: 2, title: "", topics: [{ ...topic, id: "z" }, { ...topic, id: "w", ready: false }] };
    const p = { "topic:x": progress({ completed: true }), "topic:y": progress({ completed: true }), "topic:z": progress({ furthest: 1 }) };
    expect(sectionShare(a, p)).toBe(1);
    expect(sectionShare(b, p)).toBe(0.5);
    expect(sectionShare({ topics: [{ ...topic, ready: false }] }, p)).toBe(0);
    expect(firstOpenSection([a, b], p)).toBe("b");
    expect(firstOpenSection([a, b], {})).toBe("a");
    expect(firstOpenSection([], {})).toBeNull();
  });
});

describe("class code", () => {
  beforeEach(() => vi.unstubAllEnvs());
  it("takes six characters without the confusable ones, in any case and spacing", () => {
    expect(normalizeClassCode(" k7mq-2x ")).toBe("K7MQ2X");
    expect(normalizeClassCode("K7MQ2")).toBeNull();
    expect(normalizeClassCode("K7MQ2O")).toBeNull();
    expect(normalizeClassCode(42)).toBeNull();
  });
});
