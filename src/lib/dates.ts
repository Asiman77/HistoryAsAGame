import type { HistoricalDate } from "@/domain/schema";
import type { Messages } from "./i18n";

export interface Age {
  years: number;
  /** True when either date lacks month/day or is not certain. */
  approximate: boolean;
}

export function ageAt(birth: HistoricalDate, date: HistoricalDate): Age {
  let years = date.year - birth.year;
  let precise = birth.certainty === "exact" && date.certainty === "exact";

  if (birth.month !== undefined && date.month !== undefined) {
    const before =
      date.month < birth.month ||
      (date.month === birth.month &&
        birth.day !== undefined &&
        date.day !== undefined &&
        date.day < birth.day);
    if (before) years -= 1;
    if (date.month === birth.month && (birth.day === undefined || date.day === undefined)) precise = false;
  } else {
    precise = false;
  }
  return { years: Math.max(0, years), approximate: !precise };
}

export function formatDate(date: HistoricalDate, m: Messages): string {
  const parts: string[] = [];
  if (date.day !== undefined) parts.push(String(date.day));
  if (date.month !== undefined) parts.push(m.months[date.month - 1] ?? "");
  parts.push(String(date.year));
  const text = parts.join(" ");
  return date.certainty === "exact" ? text : `${m.date.approxPrefix}${text}`;
}

/**
 * Compares two dates only at the precision both of them have, so that
 * "1488" is neither before nor after "9 July 1488".
 */
export function compareDates(
  a: { year: number; month?: number; day?: number },
  b: { year: number; month?: number; day?: number },
): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month === undefined || b.month === undefined) return 0;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day === undefined || b.day === undefined) return 0;
  return a.day - b.day;
}
