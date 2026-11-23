import type { Commemoration } from "@/domain/schema";
import type { IndexedEvent } from "./historyIndex";

export interface MonthDay {
  month: number;
  day: number;
}

/** What onThisDay needs of an event: its date. */
export type Dated = { date: Pick<IndexedEvent["date"], "year" | "month" | "day"> };

export type OnThisDay<E extends Dated = IndexedEvent> =
  /** Events that happened on this very day and month (day precision only). */
  | { mode: "day"; events: E[] }
  /** Nothing on the day: events of the month, ordered by day. */
  | { mode: "month"; events: E[] }
  | { mode: "none"; events: [] };

/**
 * "Tarixdə bu gün" from the shared index. Only steps dated to the day count
 * for the day itself; the month fallback also takes month-precision steps.
 */
export function onThisDay<E extends Dated>(index: readonly E[], { month, day }: MonthDay): OnThisDay<E> {
  const sameDay = index.filter((e) => e.date.month === month && e.date.day === day);
  if (sameDay.length) return { mode: "day", events: [...sameDay].sort((a, b) => a.date.year - b.date.year) };
  const sameMonth = index
    .filter((e) => e.date.month === month)
    .sort((a, b) => (a.date.day ?? 99) - (b.date.day ?? 99) || a.date.year - b.date.year);
  return sameMonth.length ? { mode: "month", events: sameMonth } : { mode: "none", events: [] };
}

export function commemorationOn<C extends Pick<Commemoration, "month" | "day">>(days: readonly C[], { month, day }: MonthDay): C | null {
  return days.find((c) => c.month === month && c.day === day) ?? null;
}

/** Today in the visitor's time zone, or a preview date from `?today=MM-DD` (for teachers and tests). */
export function todayFrom(search: string, now: Date): MonthDay {
  const m = /[?&]today=(\d{2})-(\d{2})/.exec(search);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
  }
  return { month: now.getMonth() + 1, day: now.getDate() };
}
