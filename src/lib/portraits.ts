import type { AgePortrait } from "@/domain/schema";

/**
 * The portrait for an age: the one whose range contains it, otherwise the
 * closest range (so a gap in the data never leaves the card empty).
 */
export function pickPortrait(portraits: AgePortrait[] | undefined, age: number): AgePortrait | null {
  if (!portraits?.length) return null;
  let best: AgePortrait | null = null;
  let bestDist = Infinity;
  for (const p of portraits) {
    const dist = age < p.ageFrom ? p.ageFrom - age : age > p.ageTo ? age - p.ageTo : 0;
    if (dist < bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  return best;
}
