import { resolveRef } from "@/domain/registry";
import type { PoliticalContext } from "@/features/engine/types";
import type { HistoryRepository } from "./repository";

/**
 * Polities, rulers and reigns for the ruler panel, limited to the years a
 * simulation covers (with a margin) so pages do not ship the whole table.
 */
export async function loadPoliticalContext(repo: HistoryRepository, from: number, to: number): Promise<PoliticalContext> {
  const [polities, rulers, reigns, registry, persons] = await Promise.all([
    repo.listPolities(),
    repo.listRulers(),
    repo.listReigns(),
    repo.getRegistry(),
    repo.listPersons(),
  ]);
  const lo = from - 10;
  const hi = to + 10;
  const inSpan = reigns.filter((r) => r.end.year >= lo && r.start.year <= hi);
  const rulerIds = new Set(inSpan.map((r) => r.rulerId));
  return {
    polities: polities
      .filter((p) => p.periods.some((pd) => pd.to >= lo && pd.from <= hi))
      .map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        periods: p.periods,
        facts: (p.facts ?? []).filter((f) => f.to >= lo && f.from <= hi),
        state: p.stateId ? resolveRef({ type: "state", id: p.stateId, label: p.name }, registry) : null,
      })),
    rulers: rulers
      .filter((r) => rulerIds.has(r.id))
      .map((r) => {
        const person = r.personId ? persons.find((p) => p.id === r.personId) : undefined;
        const image = r.portraits?.[0] ?? person?.portrait;
        return {
          id: r.id,
          name: r.name,
          titles: r.titles,
          ...(r.dynasty ? { dynasty: r.dynasty } : {}),
          ...(r.born ? { born: r.born.year } : {}),
          ...(r.died ? { died: r.died.year } : {}),
          ...(image ? { image } : {}),
          personHref: r.personId ? (resolveRef({ type: "person", id: r.personId }, registry).href ?? null) : null,
          sources: r.sources,
        };
      }),
    reigns: inSpan,
  };
}
