import { describe, expect, it } from "vitest";
import { GAP_WEIGHT, axisTicks, createTimeScale, eraSegments, nextYear, type TimeSegment } from "@/lib/timeScale";

/** Sample eras for the maths (not history): two touching eras, a gap, a late heavy era. */
const eras = [
  { id: "a", startYear: 1400, endYear: 1500 },
  { id: "b", startYear: 1490, endYear: 1599, weight: 2 },
  { id: "c", startYear: 1700, endYear: 1799, weight: 0.5 },
];

describe("era segments", () => {
  it("cut an era where the next one begins and fill the holes with gaps", () => {
    expect(eraSegments(eras)).toEqual([
      { from: 1400, to: 1489, weight: 1, eraId: "a" },
      { from: 1490, to: 1599, weight: 2, eraId: "b" },
      { from: 1600, to: 1699, weight: GAP_WEIGHT },
      { from: 1700, to: 1799, weight: 0.5, eraId: "c" },
    ]);
  });
  it("can extend the axis past the eras on both sides", () => {
    const s = eraSegments(eras, { from: 1300, to: 1850 });
    expect(s[0]).toEqual({ from: 1300, to: 1399, weight: GAP_WEIGHT });
    expect(s.at(-1)).toEqual({ from: 1800, to: 1850, weight: GAP_WEIGHT });
  });
  it("is empty without eras", () => {
    expect(eraSegments([])).toEqual([]);
  });
});

describe("piecewise-linear scale", () => {
  const segs = eraSegments(eras);
  const scale = createTimeScale(segs);
  const units = 90 * 1 + 110 * 2 + 100 * GAP_WEIGHT + 100 * 0.5;

  it("places segments by years × weight", () => {
    expect(scale.segments.map((s) => [s.x0, s.x1].map((x) => +x.toFixed(6)))).toEqual([
      [0, +(90 / units).toFixed(6)],
      [+(90 / units).toFixed(6), +(310 / units).toFixed(6)],
      [+(310 / units).toFixed(6), +((310 + 100 * GAP_WEIGHT) / units).toFixed(6)],
      [+((310 + 100 * GAP_WEIGHT) / units).toFixed(6), 1],
    ]);
    expect(scale.from).toBe(1400);
    expect(scale.to).toBe(1799);
  });

  it("maps the first year to 0 and the end of the last to 1", () => {
    expect(scale.yearToX(1400)).toBe(0);
    expect(scale.yearToX(1799)).toBeCloseTo(1 - 0.5 / units);
    expect(scale.xToYear(1)).toBe(1799);
    expect(scale.xToYear(0)).toBe(1400);
  });

  it("is monotonic and xToYear inverts yearToX for every year", () => {
    let prev = -1;
    for (let y = 1400; y <= 1799; y++) {
      const x = scale.yearToX(y);
      expect(x).toBeGreaterThan(prev);
      prev = x;
      expect(scale.xToYear(x)).toBe(y);
      expect(scale.xToYear(scale.yearCenterX(y))).toBe(y);
    }
  });

  it("gives a heavier era more room per year", () => {
    const perYear = (y: number) => scale.yearToX(y + 1) - scale.yearToX(y);
    expect(perYear(1550) / perYear(1450)).toBeCloseTo(2);
    expect(perYear(1650) / perYear(1450)).toBeCloseTo(GAP_WEIGHT);
  });

  it("clamps years and positions outside the axis", () => {
    expect(scale.yearToX(1000)).toBe(0);
    expect(scale.yearToX(2500)).toBe(1);
    expect(scale.xToYear(-0.3)).toBe(1400);
    expect(scale.xToYear(7)).toBe(1799);
  });

  it("zooms into a view: the shown years fill the axis", () => {
    const zoom = createTimeScale(segs, [1480, 1520]);
    expect(zoom.from).toBe(1480);
    expect(zoom.to).toBe(1520);
    expect(zoom.yearToX(1480)).toBe(0);
    expect(zoom.xToYear(1)).toBe(1520);
    // Inside the view the weights still apply: 1490– is twice as wide per year.
    expect((zoom.yearToX(1500) - zoom.yearToX(1499)) / (zoom.yearToX(1481) - zoom.yearToX(1480))).toBeCloseTo(2);
    expect(zoom.segments.map((s) => s.eraId)).toEqual(["a", "b"]);
  });

  it("refuses an empty or reversed view", () => {
    expect(() => createTimeScale([])).toThrow();
    expect(() => createTimeScale(segs, [1600, 1500])).toThrow();
    expect(() => createTimeScale(segs, [2000, 2100])).toThrow();
  });
});

describe("years before the common era", () => {
  const segs: TimeSegment[] = [
    { from: -3000, to: -1, weight: 0.1, eraId: "ancient" },
    { from: 1, to: 1000, weight: 1, eraId: "medieval" },
  ];
  const scale = createTimeScale(segs);

  it("has no year 0: e.ə. 1 is followed by 1", () => {
    expect(nextYear(-1)).toBe(1);
    expect(nextYear(1, -1)).toBe(-1);
    expect(nextYear(-3000, 2)).toBe(-2998);
    expect(scale.yearToX(1)).toBeCloseTo(scale.yearToX(-1) + (scale.yearToX(-1) - scale.yearToX(-2)));
    for (let i = 0; i <= 1000; i++) expect(scale.xToYear(i / 1000)).not.toBe(0);
  });

  it("round-trips every year across the era boundary", () => {
    for (const y of [-3000, -2999, -1500, -2, -1, 1, 2, 500, 999, 1000]) {
      expect(scale.xToYear(scale.yearCenterX(y))).toBe(y);
    }
    expect(scale.from).toBe(-3000);
    expect(scale.to).toBe(1000);
  });

  it("puts the boundary where 3000 years × 0.1 meet 1000 years × 1", () => {
    expect(scale.yearToX(1)).toBeCloseTo(300 / 1300);
  });
});

describe("axis ticks", () => {
  it("mark segment starts and the last year, skipping crowded ones", () => {
    const scale = createTimeScale(eraSegments(eras));
    const ticks = axisTicks(scale, 0.05);
    expect(ticks[0]).toEqual({ year: 1400, x: 0 });
    expect(ticks.at(-1)).toEqual({ year: 1799, x: 1 });
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]!.x - ticks[i - 1]!.x).toBeGreaterThanOrEqual(0.05);
  });
});
