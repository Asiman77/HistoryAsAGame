import type { Polity, PolityFacts, Reign } from "@/domain/schema";

/** Reigns of a polity covering the year (several when power was split or changed hands that year). */
export function reignsAt(polityId: string, year: number, reigns: readonly Reign[]): Reign[] {
  return reigns
    .filter((r) => r.polityId === polityId && r.start.year <= year && year <= r.end.year)
    .sort((a, b) => a.start.year - b.start.year);
}

export function factsAt(polity: Pick<Polity, "facts">, year: number): PolityFacts | null {
  return polity.facts?.find((f) => f.from <= year && year <= f.to) ?? null;
}

export function polityExistsIn(polity: Pick<Polity, "periods">, year: number): boolean {
  return polity.periods.some((p) => p.from <= year && year <= p.to);
}

export function formatReign(r: Pick<Reign, "start" | "end">): string {
  return r.start.year === r.end.year ? String(r.start.year) : `${r.start.year}–${r.end.year}`;
}
