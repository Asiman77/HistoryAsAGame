import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getRepository } from "@/data";
import { entityPath } from "@/domain/registry";
import type { Locale } from "@/domain/schema";
import { ScreenSkeleton } from "@/features/skeleton/ScreenSkeleton";
import { t as tr } from "@/lib/i18n";

type Params = Promise<{ locale: string; slug: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getRepository().listPlaces()).map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const place = (await getRepository().listPlaces()).find((p) => p.id === slug);
  return place ? { title: tr(place.names.historical, locale as Locale) } : {};
}

/** Place page with its vertical timeline (phase 10). */
export default async function PlacePage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const place = (await getRepository().listPlaces()).find((p) => p.id === slug);
  if (!place) notFound();
  const t = await getTranslations("collections.places");
  const name = tr(place.names.historical, locale as Locale);
  const modern = place.names.modern ? tr(place.names.modern, locale as Locale) : null;
  return (
    <ScreenSkeleton
      eyebrow={t(`types.${place.type}`)}
      title={name}
      subtitle={modern && modern !== name ? modern : undefined}
      legacyHref={entityPath("place", place.id)!}
    />
  );
}
