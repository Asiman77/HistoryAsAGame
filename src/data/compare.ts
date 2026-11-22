import { resolveRef } from "@/domain/registry";
import type { EntityRef, ImageAsset, LifeEvent, LocalizedText } from "@/domain/schema";
import type { Lane, LaneEvent, OwnerType } from "@/lib/compare";
import { buildRoute } from "@/lib/geo";
import { DEFAULT_THEME_ID, eraViews, pickThemes, type EraView, type ThemeMap } from "@/lib/theme";
import type { HistoryRepository } from "./repository";

export interface CompareOwner extends Lane {
  image?: ImageAsset;
}

/** Everything the compare page needs, computed at build time; the pair is picked in the browser (?a=&b=). */
export interface CompareData {
  owners: CompareOwner[];
  /** Catalogue places that steps point at: name and position. */
  places: Record<string, { name: LocalizedText; lat: number; lng: number }>;
  /** Battles that steps point at: name and link (null when it has no page yet). */
  battles: Record<string, { name: LocalizedText; href: string | null }>;
  eras: EraView[];
  themes: ThemeMap;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** At most `max` points of a long smoothed curve, keeping both ends. */
function thin(coords: [number, number][], max = 40): [number, number][] {
  if (coords.length <= max) return coords;
  const step = (coords.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => coords[Math.round(i * step)]!);
}

export async function loadCompareData(repo: HistoryRepository): Promise<CompareData> {
  const [index, persons, states, conflicts, battles, places, registry, eras, themes] = await Promise.all([
    repo.getHistoryIndex(),
    repo.listPersons(),
    repo.listStates(),
    repo.listConflicts(),
    repo.listBattles(),
    repo.listPlaces(),
    repo.getRegistry(),
    repo.listEras(),
    repo.listThemes(),
  ]);

  type Step = Pick<LifeEvent, "location"> & Partial<Pick<LifeEvent, "fromLocation" | "route">>;
  const sources: { type: OwnerType; id: string; title: LocalizedText; image?: ImageAsset; steps: Step[] }[] = [
    ...(await Promise.all(
      persons.map(async (p) => ({ type: "person" as const, id: p.id, title: p.shortName ?? p.name, ...(p.portrait ? { image: p.portrait } : {}), steps: await repo.getEvents(p.id) })),
    )),
    ...(await Promise.all(
      states.map(async (s) => ({ type: "state" as const, id: s.id, title: s.name, ...(s.image ? { image: s.image } : {}), steps: await repo.getStateSteps(s.id) })),
    )),
    ...(await Promise.all(conflicts.map(async (c) => ({ type: "conflict" as const, id: c.id, title: c.name, steps: await repo.getConflictDays(c.id) })))),
  ];

  // A war day that is a battle refers to it as well as any battle it links to (backend CompareReader.BATTLES).
  const dayBattles = new Map<string, string[]>();
  for (const b of battles) dayBattles.set(`conflict:${b.conflictId}:${b.stepId}`, [...(dayBattles.get(`conflict:${b.conflictId}:${b.stepId}`) ?? []), b.id]);

  const battleRefs = new Map<string, EntityRef>();
  const owners: CompareOwner[] = sources.map((src) => {
    const events: LaneEvent[] = index
      .filter((e) => e.entityType === src.type && e.entityId === src.id)
      .map((e) => {
        const linked = e.related.filter((r) => r.type === "battle");
        linked.forEach((r) => battleRefs.has(r.id) || battleRefs.set(r.id, r));
        const ids = [...new Set([...linked.map((r) => r.id), ...(dayBattles.get(e.key) ?? [])])].sort();
        return {
          key: e.key,
          stepId: e.stepId,
          title: e.title,
          date: e.date,
          placeId: e.placeId,
          lat: e.lat,
          lng: e.lng,
          icon: e.icon,
          mood: e.mood,
          claimType: e.claimType,
          themeId: e.themeId,
          href: e.href,
          battles: ids,
        };
      });
    // Wars stay on a small front: a line through 44 days would only scribble, so they show points only.
    const path: [number, number][] = [];
    if (src.type !== "conflict")
      for (const step of src.steps) {
        const route = buildRoute(step);
        const pts = route ? thin(route.geometry.coordinates as [number, number][]) : [[step.location.lng, step.location.lat] as [number, number]];
        for (const [lng, lat] of pts) {
          const p: [number, number] = [round(lng), round(lat)];
          const last = path.at(-1);
          if (!last || last[0] !== p[0] || last[1] !== p[1]) path.push(p);
        }
      }
    return {
      type: src.type,
      id: src.id,
      title: src.title,
      ...(src.image ? { image: src.image } : {}),
      fromYear: events[0]?.date.year ?? null,
      toYear: events.at(-1)?.date.year ?? null,
      events,
      path,
    };
  });

  for (const b of battles) if (!battleRefs.has(b.id)) battleRefs.set(b.id, { type: "battle", id: b.id });
  const battleInfo = Object.fromEntries(
    [...battleRefs.values()].map((ref) => {
      const r = resolveRef(ref, registry);
      return [ref.id, { name: r.title, href: r.href }];
    }),
  );
  const usedPlaces = new Set(owners.flatMap((o) => o.events.map((e) => e.placeId).filter((id): id is string => !!id)));
  const placeInfo = Object.fromEntries(
    places.filter((p) => usedPlaces.has(p.id)).map((p) => [p.id, { name: p.names.historical, lat: p.lat, lng: p.lng }]),
  );
  const usedThemes = new Set([DEFAULT_THEME_ID, ...eras.map((e) => e.themeId), ...owners.flatMap((o) => o.events.map((e) => e.themeId))]);

  return {
    owners: owners.filter((o) => o.events.length > 0),
    places: placeInfo,
    battles: battleInfo,
    eras: eraViews(eras, themes),
    themes: pickThemes(themes, usedThemes),
  };
}
