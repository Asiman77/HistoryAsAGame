import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getRepository } from "@/data";
import { entityPath } from "@/domain/registry";
import type { Locale } from "@/domain/schema";
import { entityTheme } from "@/features/collections/data";
import { ScreenSkeleton } from "@/features/skeleton/ScreenSkeleton";
import { t as tr } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";

type Params = Promise<{ locale: string; slug: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getRepository().listConflicts()).map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const conflict = await getRepository().getConflict(slug);
  return conflict ? { title: tr(conflict.heading, locale as Locale) } : {};
}

/** War intro screen (phase 9). */
export default async function ConflictIntroPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const conflict = await getRepository().getConflict(slug);
  if (!conflict) notFound();
  const site = await getTranslations("site");
  return (
    <ScreenSkeleton
      back={{ href: ROUTES.conflicts, label: site("nav.conflicts") }}
      eyebrow={tr(conflict.name, locale as Locale)}
      title={tr(conflict.heading, locale as Locale)}
      subtitle={conflict.years}
      themeId={await entityTheme(conflict.eraIds)}
      legacyHref={entityPath("conflict", conflict.id)!}
    />
  );
}
