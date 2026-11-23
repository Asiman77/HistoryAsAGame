import { describe, expect, it } from "vitest";
import { centuryOf, formatCentury, formatYear, formatYearOrdinal, toRoman } from "@/lib/historicalDate";

describe("historical date labels", () => {
  it("writes Roman numerals", () => {
    expect([1, 4, 7, 9, 14, 15, 16, 18, 19, 20, 21, 40, 90, 400].map(toRoman)).toEqual(["I", "IV", "VII", "IX", "XIV", "XV", "XVI", "XVIII", "XIX", "XX", "XXI", "XL", "XC", "CD"]);
    expect(() => toRoman(0)).toThrow();
  });
  it("finds the century, the turn of a century included", () => {
    expect(centuryOf(1500)).toBe(15);
    expect(centuryOf(1501)).toBe(16);
    expect(centuryOf(2000)).toBe(20);
    expect(centuryOf(2020)).toBe(21);
    expect(centuryOf(-650)).toBe(7);
    expect(centuryOf(-1)).toBe(1);
    expect(() => centuryOf(0)).toThrow();
  });
  it("labels centuries before and in the common era", () => {
    expect(formatCentury(1450)).toBe("XV əsr");
    expect(formatCentury(1717)).toBe("XVIII əsr");
    expect(formatCentury(-650)).toBe("e.ə. VII əsr");
  });
  it("labels years with Azerbaijani ordinals", () => {
    expect(formatYearOrdinal(1501)).toBe("1501-ci il");
    expect(formatYearOrdinal(1990)).toBe("1990-cı il");
    expect(formatYearOrdinal(-3000)).toBe("e.ə. 3000-ci il");
    expect(formatYear(-3000)).toBe("e.ə. 3000");
    expect(formatYear(1736)).toBe("1736");
  });
});
