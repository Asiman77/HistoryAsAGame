/** Index of the subtitle cue playing at `time` seconds, or -1 between cues. */
export function activeCueIndex(cues: readonly { start: number; end: number }[], time: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = cues[mid]!;
    if (time < c.start) hi = mid - 1;
    else if (time >= c.end) lo = mid + 1;
    else return mid;
  }
  return -1;
}
