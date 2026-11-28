import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileSystemRepository } from "@/data/fileSystemRepository";
import { allTopics, curriculumGrades, findTopic, loadGrade, loadSampleGrade, TOPIC_PLACEHOLDER, topicParams } from "@/features/curriculum/data";
import { firstOpenSection, sectionShare, topicRow, topicShare, topicStatus } from "@/features/curriculum/status";
import { buildTopic, nextTopic } from "@/features/curriculum/topic";
import { loadZamanData } from "@/features/timeline/data";
import { gradeView } from "@/features/timeline/gradeView";
import { normalizeClassCode } from "@/lib/classCode";
import type { PersonProgress } from "@/lib/progress";

/** Today's data: the curriculum of the approved textbooks (data/curriculum/azerbaijan-history). */
const repo = new FileSystemRepository();
/** The same data without curriculum, for the empty state and the sample grade of fixtures/. */
class WithoutCurriculum extends FileSystemRepository {
  override listCurriculum() {
    return Promise.resolve([]);
  }
}
const bare = new WithoutCurriculum();
const labels = { grade: "8-ci sinif", final: "Yekun quiz" };
const progress = (p: Partial<PersonProgress>): PersonProgress => ({ index: 0, phase: "journey", choices: {}, furthest: 0, completed: false, updatedAt: 1, ...p });

describe("curriculum of the textbooks (data/)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("holds grades 6–11, each with its textbook and the textbook's own topic numbers", async () => {
    const grades = await curriculumGrades(repo);
    expect(grades.map((g) => g.grade)).toEqual([6, 7, 8, 9, 10, 11]);
    for (const g of grades) {
      expect(g.sample).toBeFalsy();
      expect(g.textbook?.url).toMatch(/^https:\/\/(www\.)?trims\.edu\.az\//);
      const numbers = g.sections.flatMap((s) => s.topics.map((t) => t.paragraph));
      expect(numbers).toEqual(numbers.map((_, i) => `§ ${i + 1}`));
    }
    // The sample never replaces a grade the data has.
    vi.stubEnv("CURRICULUM_SAMPLE", "1");
    expect((await curriculumGrades(repo)).flatMap((g) => g.sections.flatMap((s) => s.topics.map((t) => t.id))).some((id) => id.startsWith("sample-"))).toBe(false);
  });

  it("builds a page for every topic that tells steps, and no placeholder", async () => {
    const params = await topicParams(repo);
    expect(params).not.toContainEqual(TOPIC_PLACEHOLDER);
    expect(params).toContainEqual({ grade: "9", topic: "veten-muharibesi" });
    expect(params).toContainEqual({ grade: "7", topic: "hesen-padsah-ve-varisleri" });
    const g6 = (await loadGrade(repo, 6, "az"))!;
    expect(g6.sections.flatMap((s) => s.topics).every((t) => !t.ready)).toBe(true);
  });

  it("the 44-day war topic tells the war's days in order", async () => {
    const found = (await findTopic(repo, 9, "veten-muharibesi"))!;
    const sim = (await buildTopic(repo, found.grade, found.topic, "az", { grade: "9-cu sinif", final: "Yekun quiz" }))!;
    expect(sim.owners.map((o) => `${o.type}:${o.id}`)).toEqual(["conflict:karabakh-war-2020"]);
    expect(sim.shell.steps[0]!.id).toBe("2020-09-27");
    expect(sim.shell.steps.map((s) => s.id)).toContain("2020-11-08");
    expect(sim.shell.steps.every((s) => s.template === "liberation")).toBe(true);
  });

  it("a topic can follow Nadir's battle with the state it built", async () => {
    const found = (await findTopic(repo, 10, "azerbaycan-torpaqlarinin-azad-olunmasi-ugrunda-mubarize"))!;
    const sim = (await buildTopic(repo, found.grade, found.topic, "az", { grade: "10-cu sinif", final: "Yekun quiz" }))!;
    expect(sim.owners.map((o) => `${o.type}:${o.id}`)).toEqual(["state:afshar", "person:nadir-shah"]);
    expect(sim.shell.subtitle).toBe("10-cu sinif · § 36");
  });
});

describe("curriculum without data, and the sample grade", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("has no grades without data, and the sample only when the build asks for it", async () => {
    expect(await curriculumGrades(bare)).toEqual([]);
    expect(await topicParams(bare)).toEqual([TOPIC_PLACEHOLDER]);
    vi.stubEnv("CURRICULUM_SAMPLE", "1");
    expect((await curriculumGrades(bare)).map((g) => g.grade)).toEqual([8]);
    expect(await curriculumGrades(bare, "world-history")).toEqual([]);
    expect(await topicParams(bare)).toEqual([
      { grade: "8", topic: "sample-agqoyunlu" },
      { grade: "8", topic: "sample-sefevi" },
      { grade: "8", topic: "sample-efshar" },
    ]);
  });

  it("a grade lists its sections and topics with steps, owners and whether they can be opened", async () => {
    vi.stubEnv("CURRICULUM_SAMPLE", "1");
    const g = (await loadGrade(bare, 8, "az"))!;
    expect(g.sample).toBe(true);
    expect(g.sections.map((s) => [s.number, s.topics.map((t) => [t.number, t.id, t.ready])])).toEqual([
      [1, [[1, "sample-agqoyunlu", true], [2, "sample-sefevi", true]]],
      [2, [[1, "sample-efshar", true], [2, "sample-preparing", false]]],
    ]);
    const efshar = g.sections[1]!.topics[0]!;
    expect(efshar).toMatchObject({ paragraph: "§ 3", steps: 4, minutes: 20, href: "/kurikulum/8/sample-efshar/", owners: ["Nadir Şah Əfşar", "Əfşarlar dövləti"] });
    expect(efshar.years).toEqual({ from: 1736, to: 1748 });
    expect(g.sections[1]!.topics[1]!.years).toBeNull();
    expect(await loadGrade(bare, 9, "az")).toBeNull();
  });

  it("a topic is told as one simulation: its steps in its own order, from several simulations", async () => {
    vi.stubEnv("CURRICULUM_SAMPLE", "1");
    const found = (await findTopic(bare, 8, "sample-efshar"))!;
    const sim = (await buildTopic(bare, found.grade, found.topic, "az", labels))!;
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
    expect((await nextTopic(bare, g, "sample-sefevi", "az"))?.id).toBe("sample-efshar");
    expect(await nextTopic(bare, g, "sample-efshar", "az")).toBeNull();
    expect((await allTopics(bare)).length).toBe(4);
  });
});

describe("timeline grade filter", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("knows the events and years of each grade whose topics tell steps, and nothing without curriculum", async () => {
    expect((await loadZamanData(bare, "az")).grades).toEqual([]);
    const grades = (await loadZamanData(repo, "az")).grades;
    expect(grades.map((g) => g.grade)).toEqual([7, 8, 9, 10, 11]);
    const g7 = grades.find((g) => g.grade === 7)!;
    expect(g7.keys).toContain("person:shah-ismayil:ismayil-coronation");
    expect(g7.keys).toContain("person:uzun-hasan:uzun-hasan-otlukbeli");
    expect(g7.keys).not.toContain("state:afshar:1747-assassination");
    expect([g7.from, g7.to]).toEqual([1452, 1522]);
    const g9 = grades.find((g) => g.grade === 9)!;
    expect(g9.keys.every((k) => k.startsWith("conflict:karabakh-war-2020:"))).toBe(true);
    expect([g9.from, g9.to]).toEqual([2020, 2020]);
  });

  it("zooms to the grade's years with some air, inside the axis", () => {
    expect(gradeView({ from: 1736, to: 1748 }, 1000, 2025)).toEqual([1726, 1758]);
    expect(gradeView({ from: 1450, to: 1750 }, 1000, 2025)).toEqual([1405, 1795]);
    expect(gradeView({ from: 1995, to: 2020 }, 1000, 2025)).toEqual([1985, 2025]);
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
