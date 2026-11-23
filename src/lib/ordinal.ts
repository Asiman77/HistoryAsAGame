/**
 * Azerbaijani ordinal suffix for a number written in digits: 1-ci, 3-cü,
 * 6-cı, 9-cu, 24-cü, 43-cü, 1501-ci, 1990-cı, 2000-ci.
 *
 * In digits the suffix is -cı/-ci/-cu/-cü (the -n- of "altıncı" is not
 * written) and follows vowel harmony with the last vowel of the last spoken
 * word: the last non-zero digit, else the tens, else yüz, min, milyon, milyard.
 */
export type OrdinalSuffix = "cı" | "ci" | "cu" | "cü";

/** bir iki üç dörd beş altı yeddi səkkiz doqquz */
const DIGITS: OrdinalSuffix[] = ["cı", "ci", "ci", "cü", "cü", "ci", "cı", "ci", "ci", "cu"];
/** (sıfır) on iyirmi otuz qırx əlli altmış yetmiş səksən doxsan */
const TENS: OrdinalSuffix[] = ["cı", "cu", "ci", "cu", "cı", "ci", "cı", "ci", "ci", "cı"];

export function ordinalSuffix(n: number): OrdinalSuffix {
  const v = Math.abs(Math.trunc(n));
  if (v === 0) return "cı"; // sıfır
  if (v % 10 !== 0) return DIGITS[v % 10]!;
  if (v % 100 !== 0) return TENS[(v % 100) / 10]!;
  if (v % 1000 !== 0) return "cü"; // yüz
  if (v % 1_000_000 !== 0) return "ci"; // min
  if (v % 1_000_000_000 !== 0) return "cu"; // milyon
  return "cı"; // milyard
}

/** "24-cü" */
export function ordinal(n: number): string {
  return `${n}-${ordinalSuffix(n)}`;
}
