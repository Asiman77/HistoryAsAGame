import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getRepository } from "@/data";
import { entityPath } from "@/domain/registry";
import type { Locale } from "@/domain/schema";
import { entityTheme } from "@/features/collections/data";
import { ScreenSkeleton } from "@/features/skeleton/ScreenSkeleton";
import { t as tr } from "@/lib/i18n";

type Params = Promise<{ locale: string; slug: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getRepository().listConflicts()).map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const conflict = await getRepository().getConflict(slug);
  const t = await getTranslations({ locale, namespace: "pages.day" });
  return conflict ? { title: `${t("eyebrow")} · ${tr(conflict.heading, locale as Locale)}` } : {};
}

/** Day view of a war, ?day=YYYY-MM-DD (phase 9). */
export default async function ConflictDayPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const conflict = await getRepository().getConflict(slug);
  if (!conflict) notFound();
  const t = await getTranslations("pages.day");
  const heading = tr(conflict.heading, locale as Locale);
  return (
    <ScreenSkeleton
      back={{ href: `/doyusler/${conflict.id}/`, label: heading }}
      eyebrow={t("eyebrow")}
      title={heading}
      subtitle={tr(conflict.name, locale as Locale)}
      themeId={await entityTheme(conflict.eraIds)}
      legacyHref={entityPath("conflict", conflict.id)!}
    />
  );
}
