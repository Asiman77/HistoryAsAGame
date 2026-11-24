/**
 * Case endings of Azerbaijani proper names, by vowel harmony with the last
 * vowel of the name: "Şah İsmayılın irsi", "Uzun Həsənlə müqayisə et".
 * Proper names keep their spelling (no k → y), the ending is written without
 * an apostrophe.
 */

const BACK_UNROUNDED = "aı";
const FRONT_UNROUNDED = "eəi";
const BACK_ROUNDED = "ou";
const FRONT_ROUNDED = "öü";
const VOWELS = BACK_UNROUNDED + FRONT_UNROUNDED + BACK_ROUNDED + FRONT_ROUNDED;

type Harmony = "a" | "e" | "o" | "ö";

function lastVowel(word: string): { harmony: Harmony; final: boolean } | null {
  const w = word.trim().toLocaleLowerCase("az");
  for (let i = w.length - 1; i >= 0; i--) {
    const c = w[i]!;
    if (!VOWELS.includes(c)) continue;
    const harmony: Harmony = BACK_UNROUNDED.includes(c) ? "a" : FRONT_UNROUNDED.includes(c) ? "e" : BACK_ROUNDED.includes(c) ? "o" : "ö";
    return { harmony, final: i === w.length - 1 };
  }
  return null;
}

const GENITIVE: Record<Harmony, string> = { a: "ın", e: "in", o: "un", ö: "ün" };

/** Yiyəlik hal: "Şah İsmayıl" → "Şah İsmayılın", "Xətai" → "Xətainin", "Nadir Şah" → "Nadir Şahın". */
export function genitive(name: string): string {
  const v = lastVowel(name);
  if (!v) return name;
  return `${name}${v.final ? "n" : ""}${GENITIVE[v.harmony]}`;
}

/** Birgəlik ("ilə" qoşması bitişik): "Uzun Həsən" → "Uzun Həsənlə", "Şah İsmayıl" → "Şah İsmayılla", "Xətai" → "Xətaiylə". */
export function comitative(name: string): string {
  const v = lastVowel(name);
  if (!v) return name;
  const back = v.harmony === "a" || v.harmony === "o";
  return `${name}${v.final ? "y" : ""}${back ? "la" : "lə"}`;
}
