import { entityPath } from "@/domain/registry";
import type { Place, TerritorySnapshotMeta } from "@/domain/schema";
import type { PoliticalContext } from "@/features/engine/types";
import type { IndexedEvent } from "@/lib/historyIndex";
import { SLIDER_FROM, SLIDER_TO, type SliderPerson } from "@/lib/timeSlider";
import { DEFAULT_THEME_ID, eraViews, pickThemes, type EraView, type ThemeMap } from "@/lib/theme";
import { loadPoliticalContext } from "./political";
import type { HistoryRepository } from "./repository";

/** Everything the global time slider needs, computed at build time and serialisable. */
export interface TimeExplorerData {
  from: number;
  to: number;
  eras: EraView[];
  themes: ThemeMap;
  snapshots: TerritorySnapshotMeta[];
  political: PoliticalContext;
  landmarks: Place[];
  events: IndexedEvent[];
  persons: SliderPerson[];
}

export async function loadTimeExplorerData(repo: HistoryRepository): Promise<TimeExplorerData> {
  const [eras, themes, snapshots, places, events, persons] = await Promise.all([
    repo.listEras(),
    repo.listThemes(),
    repo.listTerritorySnapshots(),
    repo.listPlaces(),
    repo.getHistoryIndex(),
    repo.listPersons(),
  ]);
  const political = await loadPoliticalContext(repo, SLIDER_FROM, SLIDER_TO);
  const sliderPersons: SliderPerson[] = await Promise.all(
    persons.map(async (p) => {
      const evs = await repo.getEvents(p.id);
      return {
        id: p.id,
        name: p.shortName ?? p.name,
        href: entityPath("person", p.id)!,
        ...(p.portrait ? { image: p.portrait } : {}),
        birth: { year: p.birth.date.year, certainty: p.birth.date.certainty },
        death: { year: p.death.date.year, certainty: p.death.date.certainty },
        track: evs.map((e) => ({ year: e.date.year, lng: e.location.lng, lat: e.location.lat })),
      };
    }),
  );
  return {
    from: SLIDER_FROM,
    to: SLIDER_TO,
    eras: eraViews(eras, themes),
    themes: pickThemes(themes, [DEFAULT_THEME_ID, ...eras.map((e) => e.themeId)]),
    snapshots,
    political,
    // Capitals only: the slider marks seats of power, not every town.
    landmarks: places.filter((p) => snapshots.some((s) => s.polities.some((x) => x.capitalId === p.id))),
    events,
    persons: sliderPersons,
  };
}
