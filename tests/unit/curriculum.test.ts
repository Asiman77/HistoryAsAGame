import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { FileSystemRepository } from "@/data/fileSystemRepository";
import { checkCurriculum, type StepCatalogue } from "@/domain/integrity";
import { CurriculumGrade } from "@/domain/schema";

const sample = JSON.parse(fs.readFileSync("fixtures/curriculum.sample.json", "utf8")) as unknown;

async function catalogue(): Promise<StepCatalogue> {
  const repo = new FileSystemRepository();
  const out: StepCatalogue = new Map();
  for (const p of await repo.listPersons()) out.set(`person:${p.id}`, new Set((await repo.getEvents(p.id)).map((e) => e.id)));
  for (const s of await repo.listStates()) out.set(`state:${s.id}`, new Set((await repo.getStateSteps(s.id)).map((x) => x.id)));
  for (const c of await repo.listConflicts()) out.set(`conflict:${c.id}`, new Set((await repo.getConflictDays(c.id)).map((d) => d.id)));
  return out;
}

describe("curriculum (B2)", () => {
  it("the sample grade parses and is marked as sample content", () => {
    const grade = CurriculumGrade.parse(sample);
    expect(grade.sample).toBe(true);
    expect(grade.id).toBe(`${grade.subject}-${grade.grade}`);
    expect(grade.sections.flatMap((s) => s.topics).some((t) => t.steps.length === 0)).toBe(true);
  });

  it("the sample's topics point at steps that exist in data/", async () => {
    const grade = CurriculumGrade.parse(sample);
    expect(checkCurriculum(grade, await catalogue(), new Map(), "fixtures/curriculum.sample.json")).toEqual([]);
  });

  it("an unknown simulation, a missing step and a topic id used twice are reported", async () => {
    const grade = CurriculumGrade.parse(sample);
    const broken = structuredClone(grade);
    broken.sections[0]!.topics[0]!.steps.push({ type: "person", id: "nobody", stepId: "x" }, { type: "person", id: "shah-ismayil", stepId: "no-such-step" });
    const seen = new Map([["sample-sefevi", "data/curriculum/azerbaijan-history/7.json"]]);
    const issues = checkCurriculum(broken, await catalogue(), seen, "data/curriculum/azerbaijan-history/8.json").map((i) => i.message);
    expect(issues).toEqual([
      expect.stringContaining("naməlum simulyasiya person:nobody"),
      expect.stringContaining("no-such-step addımı yoxdur"),
      expect.stringContaining("sample-sefevi: mövzu id-si başqa sinifdə də var"),
    ]);
  });

  it("refuses a grade whose id does not match subject and grade, or whose topic ids repeat", () => {
    const grade = CurriculumGrade.parse(sample);
    expect(() => CurriculumGrade.parse({ ...grade, id: "azerbaijan-history-9" })).toThrow();
    const twice = structuredClone(grade);
    twice.sections[1]!.topics[0]!.id = "sample-agqoyunlu";
    expect(() => CurriculumGrade.parse(twice)).toThrow();
  });

  it("the repository lists the grades of data/curriculum in order, and none for a subject without data", async () => {
    const repo = new FileSystemRepository();
    expect((await repo.listCurriculum()).map((g) => g.grade)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(await repo.listCurriculum("world-history")).toEqual([]);
  });

  it("the curriculum of data/ points at steps that exist and uses each topic id once", async () => {
    const seen = new Map<string, string>();
    const steps = await catalogue();
    for (const grade of await new FileSystemRepository().listCurriculum()) {
      expect(checkCurriculum(grade, steps, seen, `data/curriculum/${grade.subject}/${grade.grade}.json`)).toEqual([]);
    }
  });
});
