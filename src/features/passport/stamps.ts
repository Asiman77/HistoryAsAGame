/**
 * Which places of a simulation earn a passport stamp (§6.9), computed at
 * build time. A catalogue place (data/places.json) is stamped under its id,
 * so Təbriz reached with Uzun Həsən and with Şah İsmayıl is one stamp; a
 * place outside the catalogue under its rounded coordinates. Battlefields
 * are not stamped (the passport is for the towns the story passes through).
 */
import type { Locale } from "@/domain/schema";
import type { Journey } from "@/features/simulation/model";
import { t } from "@/lib/i18n";

/** [lng, lat] */
type LngLat = [number, number];

export interface StampPlace {
  id: string;
  /** Short name as the story shows it ("Lahican"). */
  name: string;
  center: LngLat;
  /** Step indexes that happen here. */
  steps: number[];
}

/** "Lahican (Gilan)" → "Lahican" */
export const shortPlace = (name: string) => name.replace(/\s*\(.*\)\s*$/, "").trim();

export function journeyStamps(journey: Pick<Journey, "places" | "steps" | "landmarks">, locale: Locale): StampPlace[] {
  const out = new Map<string, StampPlace>();
  for (const mp of journey.places) {
    const catalogue = mp.placeId ? journey.landmarks.find((l) => l.id === mp.placeId) : undefined;
    const battleOnly = mp.steps.every((i) => journey.steps[i]?.event.type === "battle");
    if (catalogue?.type === "battlefield" || (!catalogue && battleOnly)) continue;
    const id = mp.placeId ?? `geo:${mp.key}`;
    const existing = out.get(id);
    if (existing) existing.steps.push(...mp.steps);
    else out.set(id, { id, name: shortPlace(t(mp.place.name, locale)), center: [mp.place.lng, mp.place.lat], steps: [...mp.steps] });
  }
  return [...out.values()].map((s) => ({ ...s, steps: [...s.steps].sort((a, b) => a - b) }));
}
