import type { Certainty, ImageAsset, LocalizedText, Reign } from "@/domain/schema";
import type { IndexedEvent } from "./historyIndex";
import { SNAPSHOT_REACH_YEARS } from "./placeHistory";
import type { EraView } from "./theme";

/** Range of the global time slider (MVP). */
export const SLIDER_FROM = 1400;
export const SLIDER_TO = 2020;

export interface SnapshotPick {
  /** Snapshot to draw; in a gap this is the nearest one, drawn faded. */
  id: string | null;
  /** The map really describes this year (a snapshot at most 30 years older). */
  covered: boolean;
  /** Nearest years with a map before and after, for "jump" buttons in a gap. */
  prevYear: number | null;
  nextYear: number | null;
}

/**
 * Map for a year of the slider. Unlike a simulation step (which may borrow a
 * map up to 60 years old), the slider only claims coverage within the same
 * 30-year reach the place pages use; outside it the page says so.
 */
export function snapshotForYear(year: number, snapshots: readonly { id: string; year: number }[]): SnapshotPick {
  const sorted = [...snapshots].sort((a, b) => a.year - b.year);
  const before = sorted.filter((s) => s.year <= year).at(-1) ?? null;
  const after = sorted.find((s) => s.year > year) ?? null;
  const covered = !!before && year - before.year <= SNAPSHOT_REACH_YEARS;
  const nearest = [before, after].filter((s) => s !== null).sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))[0] ?? null;
  return {
    id: covered ? before!.id : (nearest?.id ?? null),
    covered,
    prevYear: covered ? null : (before ? Math.min(before.year + SNAPSHOT_REACH_YEARS, year - 1) : null),
    nextYear: covered ? null : (after?.year ?? null),
  };
}

/** Reigns running in a year (a ruler who ended or began a reign that year counts). */
export function reignsInYear(year: number, reigns: readonly Reign[]): Reign[] {
  return reigns.filter((r) => r.start.year <= year && r.end.year >= year);
}

export interface SliderPerson {
  id: string;
  name: LocalizedText;
  href: string;
  image?: ImageAsset;
  birth: { year: number; certainty: Certainty };
  death: { year: number; certainty: Certainty };
  /** Where the person was, by year (one entry per event, chronological). */
  track: { year: number; lng: number; lat: number }[];
}

export interface PersonAtYear {
  person: SliderPerson;
  /** Age in whole years; approximate when the birth year is not exact. */
  age: number;
  approximate: boolean;
  lng: number;
  lat: number;
}

/** Persons alive in a year, with their age and their last known position. */
export function personsInYear(year: number, persons: readonly SliderPerson[]): PersonAtYear[] {
  return persons
    .filter((p) => p.birth.year <= year && p.death.year >= year)
    .map((p) => {
      const at = p.track.filter((x) => x.year <= year).at(-1) ?? p.track[0]!;
      return { person: p, age: year - p.birth.year, approximate: p.birth.certainty !== "exact", lng: at.lng, lat: at.lat };
    });
}

export function eventsInYear(year: number, index: readonly IndexedEvent[]): IndexedEvent[] {
  return index.filter((e) => e.date.year === year);
}

/** Closest years before and after with any event, for an empty year. */
export function nearestEventYears(year: number, index: readonly IndexedEvent[]): { prev: number | null; next: number | null } {
  let prev: number | null = null;
  let next: number | null = null;
  for (const e of index) {
    const y = e.date.year;
    if (y < year && (prev === null || y > prev)) prev = y;
    if (y > year && (next === null || y < next)) next = y;
  }
  return { prev, next };
}

export type EraSegment = { kind: "era"; era: EraView; from: number; to: number } | { kind: "gap"; from: number; to: number };

/**
 * Coloured bands under the slider. Overlapping eras are cut where the newer one
 * starts (Ağqoyunlu ends where Səfəvi begins); uncovered years become gaps.
 */
export function eraSegments(eras: readonly EraView[], from = SLIDER_FROM, to = SLIDER_TO): EraSegment[] {
  const sorted = [...eras].sort((a, b) => a.startYear - b.startYear);
  const out: EraSegment[] = [];
  let cursor = from;
  sorted.forEach((era, i) => {
    const start = Math.max(era.startYear, from, cursor);
    const nextStart = sorted[i + 1]?.startYear ?? Infinity;
    const end = Math.min(era.endYear, to, nextStart - 1);
    if (end < start) return;
    if (start > cursor) out.push({ kind: "gap", from: cursor, to: start - 1 });
    out.push({ kind: "era", era, from: start, to: end });
    cursor = end + 1;
  });
  if (cursor <= to) out.push({ kind: "gap", from: cursor, to });
  return out;
}

/** Position of a year on the slider track, 0..100 (%). */
export const yearToPercent = (year: number, from = SLIDER_FROM, to = SLIDER_TO) => ((year - from) / (to - from)) * 100;
