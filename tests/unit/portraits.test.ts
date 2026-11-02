import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Person, type AgePortrait } from "@/domain/schema";
import { checkPortraits } from "@/domain/integrity";
import { pickPortrait } from "@/lib/portraits";

const p = (ageFrom: number, ageTo: number, kind: AgePortrait["kind"] = "ai_illustration"): AgePortrait => ({
  ageFrom,
  ageTo,
  kind,
  alt: { az: "x" },
  promptId: "x",
});

const load = (id: string) =>
  Person.parse(JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "persons", id, "person.json"), "utf8")));

describe("pickPortrait", () => {
  const list = [p(0, 6), p(7, 13), p(23, 37, "historical")];
  it("picks the range that contains the age", () => {
    expect(pickPortrait(list, 0)?.ageTo).toBe(6);
    expect(pickPortrait(list, 13)?.ageFrom).toBe(7);
    expect(pickPortrait(list, 30)?.kind).toBe("historical");
  });
  it("falls back to the closest range in a gap and beyond the ends", () => {
    expect(pickPortrait(list, 15)?.ageFrom).toBe(7);
    expect(pickPortrait(list, 21)?.ageFrom).toBe(23);
    expect(pickPortrait(list, 60)?.ageFrom).toBe(23);
  });
  it("returns null without portraits", () => {
    expect(pickPortrait(undefined, 5)).toBeNull();
    expect(pickPortrait([], 5)).toBeNull();
  });
});

describe("checkPortraits", () => {
  const base = load("shah-ismayil");
  it("accepts the shipped data", () => {
    for (const id of ["shah-ismayil", "uzun-hasan", "nadir-shah"]) expect(checkPortraits(load(id), id)).toEqual([]);
  });
  it("rejects overlaps, missing licences and ages past the lifespan", () => {
    const issues = checkPortraits(
      { ...base, portraits: [p(0, 10), p(10, 20), { ...p(21, 60, "historical"), src: "/portraits/a.jpg", promptId: undefined }] },
      "f",
    ).map((i) => i.message);
    expect(issues.some((m) => m.includes("üst-üstə"))).toBe(true);
    expect(issues.some((m) => m.includes("license"))).toBe(true);
    expect(issues.some((m) => m.includes("ömür"))).toBe(true);
  });
  it("never allows AI images of modern people", () => {
    const modern = { ...base, birth: { ...base.birth, date: { year: 1960, certainty: "exact" as const } } };
    modern.death = { ...base.death, date: { year: 2020, certainty: "exact" as const } };
    const issues = checkPortraits({ ...modern, portraits: [p(20, 30)] }, "f");
    expect(issues.map((i) => i.message).join()).toContain("AI şəkli olmaz");
  });
});
