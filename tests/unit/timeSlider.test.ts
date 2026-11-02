import { describe, expect, it } from "vitest";
import type { Reign } from "@/domain/schema";
import type { IndexedEvent } from "@/lib/historyIndex";
import type { EraView } from "@/lib/theme";
import {
  eraSegments,
  eventsInYear,
  nearestEventYears,
  personsInYear,
  reignsInYear,
  snapshotForYear,
  yearToPercent,
  type SliderPerson,
} from "@/lib/timeSlider";

const snaps = [
  { id: "y1501", year: 1501 },
  { id: "y1520", year: 1520 },
  { id: "y1796", year: 1796 },
  { id: "y2020", year: 2020 },
];

describe("snapshotForYear", () => {
  it("uses the latest map within 30 years", () => {
    expect(snapshotForYear(1514, snaps)).toMatchObject({ id: "y1501", covered: true });
    expect(snapshotForYear(1540, snaps)).toMatchObject({ id: "y1520", covered: true });
  });
  it("in a long silence shows the nearest map but says the year is not covered", () => {
    const p = snapshotForYear(1900, snaps);
    expect(p).toMatchObject({ covered: false, prevYear: 1826, nextYear: 2020 });
    expect(snapshotForYear(1990, snaps).id).toBe("y2020");
    expect(snapshotForYear(1450, snaps)).toMatchObject({ id: "y1501", covered: false, prevYear: null, nextYear: 1501 });
  });
});

describe("what the year shows", () => {
  const reign = (polityId: string, from: number, to: number): Reign => ({ polityId, rulerId: polityId, start: { year: from }, end: { year: to }, certainty: "exact" });
  it("counts a ruler in the years a reign starts and ends", () => {
    const rs = [reign("a", 1501, 1524), reign("b", 1524, 1576)];
    expect(reignsInYear(1524, rs).map((r) => r.polityId)).toEqual(["a", "b"]);
    expect(reignsInYear(1500, rs)).toEqual([]);
  });
  it("places a living person at their last known position, with age", () => {
    const p: SliderPerson = {
      id: "x",
      name: { az: "X" },
      href: "/persons/x/",
      birth: { year: 1487, certainty: "exact" },
      death: { year: 1524, certainty: "exact" },
      track: [
        { year: 1487, lng: 48, lat: 38 },
        { year: 1501, lng: 46, lat: 38 },
      ],
    };
    expect(personsInYear(1500, [p])[0]).toMatchObject({ age: 13, lng: 48, approximate: false });
    expect(personsInYear(1514, [p])[0]).toMatchObject({ age: 27, lng: 46 });
    expect(personsInYear(1530, [p])).toEqual([]);
  });
  it("finds the year's events and the nearest years that have some", () => {
    const ev = (year: number) => ({ key: String(year), date: { year, certainty: "exact" } }) as IndexedEvent;
    const index = [ev(1501), ev(1514), ev(1736)];
    expect(eventsInYear(1514, index)).toHaveLength(1);
    expect(nearestEventYears(1600, index)).toEqual({ prev: 1514, next: 1736 });
  });
});

describe("era bands", () => {
  const era = (id: string, startYear: number, endYear: number) => ({ id, startYear, endYear, color: "#000", name: { az: id } }) as EraView;
  it("cuts overlaps where the newer era starts and marks uncovered years", () => {
    const segs = eraSegments([era("agqoyunlu", 1378, 1503), era("sefevi", 1501, 1736), era("muasir", 1991, 2025)], 1400, 2020);
    expect(segs.map((s) => (s.kind === "era" ? `${s.era.id}:${s.from}-${s.to}` : `gap:${s.from}-${s.to}`))).toEqual([
      "agqoyunlu:1400-1500",
      "sefevi:1501-1736",
      "gap:1737-1990",
      "muasir:1991-2020",
    ]);
  });
  it("maps years onto the track", () => {
    expect(yearToPercent(1400, 1400, 2020)).toBe(0);
    expect(yearToPercent(2020, 1400, 2020)).toBe(100);
  });
});
