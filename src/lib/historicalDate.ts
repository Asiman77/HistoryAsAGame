import { ordinal } from "./ordinal";

/*
 * Year and century labels of the new design (FRONTEND_SPEC §12): "1501-ci il",
 * "XV əsr", "e.ə. VII əsr". Years before the common era are negative in the
 * data (−3000 = e.ə. 3000); there is no year 0.
 */

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Roma rəqəmi yalnız müsbət tam ədəd üçündür: ${n}`);
  let rest = n;
  let out = "";
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

const BCE = "e.ə.";

/** 1501 → 16, −650 → 7 (e.ə.). */
export function centuryOf(year: number): number {
  if (year === 0) throw new Error("0-cı il yoxdur");
  return Math.ceil(Math.abs(year) / 100);
}

/** "XVI əsr", "e.ə. VII əsr" */
export function formatCentury(year: number): string {
  const label = `${toRoman(centuryOf(year))} əsr`;
  return year < 0 ? `${BCE} ${label}` : label;
}

/** "1501", "e.ə. 3000" */
export function formatYear(year: number): string {
  return year < 0 ? `${BCE} ${-year}` : String(year);
}

/** "1501-ci il", "e.ə. 3000-ci il" */
export function formatYearOrdinal(year: number): string {
  return year < 0 ? `${BCE} ${ordinal(-year)} il` : `${ordinal(year)} il`;
}
