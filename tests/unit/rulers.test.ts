import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { ReignsFile, type Reign } from "@/domain/schema";
import { factsAt, formatReign, polityExistsIn, reignsAt } from "@/lib/rulers";

const reigns: Reign[] = ReignsFile.parse(JSON.parse(fs.readFileSync("data/reigns.json", "utf8"))).reigns;
const ruler = (polity: string, year: number) => reignsAt(polity, year, reigns).map((r) => r.rulerId);

describe("ruler lookup by year", () => {
  it("finds the ruler from the reign table", () => {
    expect(ruler("ottoman", 1514)).toEqual(["selim-i"]);
    expect(ruler("agqoyunlu", 1472)).toEqual(["uzun-hasan"]);
    expect(ruler("safavid", 1736)).toEqual(["abbas-iii"]);
    expect(ruler("mughal", 1739)).toEqual(["muhammad-shah"]);
  });
  it("handles split and returning reigns", () => {
    expect(ruler("ottoman", 1445)).toEqual(["mehmed-ii"]);
    expect(ruler("ottoman", 1450)).toEqual(["murad-ii"]);
    // Ağqoyunlu split between Əlvənd and Murad
    expect(ruler("agqoyunlu", 1501)).toEqual(["alvand-aq", "murad-aq"]);
  });
  it("returns nothing for polities without data", () => {
    expect(ruler("georgia", 1460)).toEqual([]);
  });
});

describe("polity facts", () => {
  const polity = {
    periods: [{ from: 1501, to: 1736 }],
    facts: [{ from: 1501, to: 1513, status: "rise" as const, statusNote: { az: "x" }, sources: [{ title: "s", type: "web" as const }] }],
  };
  it("picks the facts span for a year", () => {
    expect(factsAt(polity, 1505)?.status).toBe("rise");
    expect(factsAt(polity, 1600)).toBeNull();
    expect(polityExistsIn(polity, 1500)).toBe(false);
  });
  it("formats single-year reigns", () => {
    expect(formatReign({ start: { year: 1478 }, end: { year: 1478 } })).toBe("1478");
    expect(formatReign({ start: { year: 1452 }, end: { year: 1478 } })).toBe("1452–1478");
  });
});
