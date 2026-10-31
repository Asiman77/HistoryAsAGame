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

/** Sortable numeric key, used to check chronological order. */
export function dateKey(d: { year: number; month?: number; day?: number }): number {
  return d.year * 10000 + (d.month ?? 0) * 100 + (d.day ?? 0);
}
