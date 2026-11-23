import { describe, expect, it } from "vitest";
import { ordinal, ordinalSuffix } from "@/lib/ordinal";

describe("Azerbaijani ordinals in digits", () => {
  it.each([
    [1, "1-ci"],
    [2, "2-ci"],
    [3, "3-cü"],
    [4, "4-cü"],
    [5, "5-ci"],
    [6, "6-cı"],
    [7, "7-ci"],
    [8, "8-ci"],
    [9, "9-cu"],
    [10, "10-cu"],
    [11, "11-ci"],
    [20, "20-ci"],
    [24, "24-cü"],
    [30, "30-cu"],
    [40, "40-cı"],
    [43, "43-cü"],
    [44, "44-cü"],
    [50, "50-ci"],
    [60, "60-cı"],
    [70, "70-ci"],
    [80, "80-ci"],
    [90, "90-cı"],
    [100, "100-cü"],
    [300, "300-cü"],
    [1000, "1000-ci"],
    [1501, "1501-ci"],
    [1600, "1600-cü"],
    [1736, "1736-cı"],
    [1918, "1918-ci"],
    [1990, "1990-cı"],
    [2000, "2000-ci"],
    [2020, "2020-ci"],
    [1_000_000, "1000000-cu"],
    [2_000_000_000, "2000000000-cı"],
    [0, "0-cı"],
  ])("%i → %s", (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });

  it("uses the magnitude for negative numbers (BC years are written without the sign)", () => {
    expect(ordinalSuffix(-3000)).toBe(ordinalSuffix(3000));
    expect(ordinalSuffix(-7)).toBe("ci");
  });

  it("covers every grade of the curriculum", () => {
    expect([6, 7, 8, 9, 10, 11].map(ordinal)).toEqual(["6-cı", "7-ci", "8-ci", "9-cu", "10-cu", "11-ci"]);
  });
});
