/** Snapshots further back than this are considered unrelated to the event (e.g. 1520 for 1688). */
const MAX_LOOKBACK_YEARS = 60;

/**
 * Chooses the political map for a year: the latest snapshot not after it, so a
 * map never shows a result before it happened. When the nearest earlier one is
 * too old, the nearest snapshot overall is used instead.
 */
export function pickSnapshotId(
  year: number,
  snapshots: readonly { id: string; year: number }[],
  override?: string,
): string | null {
  if (override && snapshots.some((s) => s.id === override)) return override;
  if (snapshots.length === 0) return null;
  const sorted = [...snapshots].sort((a, b) => a.year - b.year);
  const before = sorted.filter((s) => s.year <= year).at(-1);
  if (before && year - before.year <= MAX_LOOKBACK_YEARS) return before.id;
  return sorted.reduce((best, s) => (Math.abs(s.year - year) < Math.abs(best.year - year) ? s : best)).id;
}
