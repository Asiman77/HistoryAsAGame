/**
 * The non-linear time axis of the timeline (FRONTEND_SPEC §6.2). A linear
 * axis from the stone age to today would squeeze every century of interest
 * into a hair, so each era gets a `weight` (width per year relative to the
 * others) and the axis is piecewise linear: inside a segment years are evenly
 * spaced, segments are as wide as `years × weight`. Years between eras form
 * gaps with their own (small) weight.
 *
 * Years follow the data: negative before the common era (−3000 = e.ə. 3000),
 * no year 0, so e.ə. 1 is directly followed by 1. Positions are 0..1.
 */

export interface TimeSegment {
  /** First and last year, inclusive. */
  from: number;
  to: number;
  /** Width per year relative to other segments (> 0). */
  weight: number;
  /** The era of the segment; absent in a gap. */
  eraId?: string;
}

export interface PlacedSegment extends TimeSegment {
  /** Where the segment starts and ends on the axis, 0..1. */
  x0: number;
  x1: number;
}

export interface TimeScale {
  /** Shown range, inclusive. */
  from: number;
  to: number;
  segments: PlacedSegment[];
  /** Left edge of the year on the axis, 0..1; years outside the range are clamped. */
  yearToX(year: number): number;
  /** Middle of the year, for markers. */
  yearCenterX(year: number): number;
  /** The year under a position (0..1, clamped). */
  xToYear(x: number): number;
}

/** Width per year of the years no era covers: they stay on the axis, but narrow. */
export const GAP_WEIGHT = 0.15;

/** Data years → a continuous count: …, e.ə. 2 → −1, e.ə. 1 → 0, 1 → 1, … */
const toLine = (year: number) => (year < 0 ? year + 1 : year);
/** Back from the continuous count (0 is e.ə. 1). */
const fromLine = (t: number) => (t <= 0 ? t - 1 : t);

/** Next and previous data year (skipping the missing year 0). */
export const nextYear = (year: number, n = 1) => fromLine(toLine(year) + n);

/**
 * Segments of the axis from eras: overlapping eras are cut where the newer one
 * begins (Ağqoyunlu ends when Səfəvi starts), uncovered years become gaps.
 */
export function eraSegments(
  eras: readonly { id: string; startYear: number; endYear: number; weight?: number | undefined }[],
  opts: { gapWeight?: number; from?: number; to?: number } = {},
): TimeSegment[] {
  const sorted = [...eras].sort((a, b) => toLine(a.startYear) - toLine(b.startYear));
  if (!sorted.length) return [];
  const from = opts.from ?? sorted[0]!.startYear;
  const to = opts.to ?? Math.max(...sorted.map((e) => toLine(e.endYear)));
  const end = toLine(to);
  const gapWeight = opts.gapWeight ?? GAP_WEIGHT;
  const out: TimeSegment[] = [];
  let cursor = toLine(from);
  sorted.forEach((era, i) => {
    const start = Math.max(toLine(era.startYear), cursor);
    const next = sorted[i + 1];
    const last = Math.min(toLine(era.endYear), end, next ? toLine(next.startYear) - 1 : Infinity);
    if (last < start) return;
    if (start > cursor) out.push({ from: fromLine(cursor), to: fromLine(start - 1), weight: gapWeight });
    out.push({ from: fromLine(start), to: fromLine(last), weight: era.weight ?? 1, eraId: era.id });
    cursor = last + 1;
  });
  if (cursor <= end) out.push({ from: fromLine(cursor), to: fromLine(end), weight: gapWeight });
  return out;
}

/**
 * A scale over the segments, or over the part of them in `view` (zoom: the
 * axis widens to show only those years).
 */
export function createTimeScale(all: readonly TimeSegment[], view?: readonly [number, number]): TimeScale {
  if (!all.length) throw new Error("zaman oxu üçün ən azı bir seqment lazımdır");
  const lo = view ? toLine(view[0]) : toLine(all[0]!.from);
  const hi = view ? toLine(view[1]) : toLine(all.at(-1)!.to);
  if (hi < lo) throw new Error(`zaman oxunun sonu əvvəlindən əvvəldir: ${view?.join("–")}`);

  // Segments clipped to the view, as half-open ranges on the continuous line.
  type Part = { seg: TimeSegment; a: number; b: number; units: number; before: number };
  const parts: Part[] = [];
  let total = 0;
  for (const seg of all) {
    const a = Math.max(toLine(seg.from), lo);
    const b = Math.min(toLine(seg.to), hi) + 1;
    if (b <= a) continue;
    const units = (b - a) * seg.weight;
    parts.push({ seg, a, b, units, before: total });
    total += units;
  }
  if (!parts.length || total <= 0) throw new Error("görünən aralıqda seqment yoxdur");

  const lineToX = (t: number) => {
    const c = Math.min(Math.max(t, parts[0]!.a), parts.at(-1)!.b);
    const p = parts.find((q) => c < q.b) ?? parts.at(-1)!;
    return (p.before + (Math.min(c, p.b) - p.a) * p.seg.weight) / total;
  };

  return {
    from: fromLine(parts[0]!.a),
    to: fromLine(parts.at(-1)!.b - 1),
    segments: parts.map((p) => ({
      ...p.seg,
      from: fromLine(p.a),
      to: fromLine(p.b - 1),
      x0: p.before / total,
      x1: (p.before + p.units) / total,
    })),
    yearToX: (year) => lineToX(toLine(year)),
    yearCenterX: (year) => lineToX(toLine(year) + 0.5),
    xToYear(x) {
      // A hair of tolerance: the left edge of a year must give that year back despite rounding.
      const eps = total * 1e-9;
      const units = Math.min(Math.max(x, 0), 1) * total + eps;
      const p = parts.find((q) => units < q.before + q.units) ?? parts.at(-1)!;
      const t = Math.floor(p.a + (units - p.before) / p.seg.weight);
      return fromLine(Math.min(Math.max(t, p.a), p.b - 1));
    },
  };
}

/** Ticks for the axis: segment starts, plus the last year, without labels closer than `minGap` (0..1). */
export function axisTicks(scale: TimeScale, minGap = 0.06): { year: number; x: number }[] {
  const all = [...scale.segments.map((s) => ({ year: s.from, x: s.x0 })), { year: scale.to, x: 1 }];
  const out: { year: number; x: number }[] = [];
  for (const t of all) {
    if (out.length && t.x - out.at(-1)!.x < minGap) {
      // Keep the last year: it marks the end of the axis.
      if (t.x === 1) out[out.length - 1] = t;
      continue;
    }
    out.push(t);
  }
  return out;
}
