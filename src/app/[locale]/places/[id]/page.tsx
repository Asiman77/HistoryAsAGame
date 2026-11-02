import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/data";
import { resolveRef } from "@/domain/registry";
import type { Locale } from "@/domain/schema";
import { PlacePage } from "@/features/places/PlacePage";
import { eventsAtPlace } from "@/lib/historyIndex";
import { getMessages, t } from "@/lib/i18n";
import { clipToLifetime, placeMembership } from "@/lib/placeHistory";
import { pickThemeId, pickThemes } from "@/lib/theme";

type Params = Promise<{ locale: string; id: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  const places = await getRepository().listPlaces();
  return places.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const place = (await getRepository().listPlaces()).find((p) => p.id === id);
  return place ? { title: t(place.names.historical, locale as Locale), description: t(place.description, locale as Locale) } : {};
}

/** A place across every category: who held it when, and every step that happened there. */
export default async function Page({ params }: { params: Params }) {
  const { locale, id } = await params;
  const repo = getRepository();
  const [places, index, metas, allThemes, eras, registry, polities] = await Promise.all([
    repo.listPlaces(),
    repo.getHistoryIndex(),
    repo.listTerritorySnapshots(),
    repo.listThemes(),
    repo.listEras(),
    repo.getRegistry(),
    repo.listPolities(),
  ]);
  const place = places.find((p) => p.id === id);
  if (!place) notFound();

  const events = eventsAtPlace(index, id);
  const snapshots = (await Promise.all(metas.map((m) => repo.getTerritorySnapshot(m.id)))).filter((s) => s !== null);
  const membership = clipToLifetime(placeMembership(id, [place.lng, place.lat], snapshots), place.periods);
  const firstYear = events[0]?.date.year ?? place.periods[0]!.from;
  const placeThemeId = pickThemeId({ year: firstYear, entityEras: [], allEras: eras });
  const upcoming = (place.upcoming ?? []).map((u) => ({
    year: u.year,
    title: u.title,
    sources: u.sources,
    ref: u.ref ? resolveRef(u.ref, registry) : null,
  }));
  const polityNames = Object.fromEntries(polities.map((p) => [p.id, p.name]));

  return (
    <PlacePage
      place={place}
      events={events}
      membership={membership}
      upcoming={upcoming}
      polityNames={polityNames}
      themeId={placeThemeId}
      themes={pickThemes(allThemes, [placeThemeId, ...events.map((e) => e.themeId)])}
      locale={locale as Locale}
      messages={getMessages(locale as Locale)}
    />
  );
}
