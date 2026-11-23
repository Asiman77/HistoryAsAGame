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
  return (await getRepository().listPersons()).map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const person = await getRepository().getPerson(slug);
  return person ? { title: tr(person.name, locale as Locale) } : {};
}

/** Person simulation: SimulationShell arrives in phases 3–5. */
export default async function PersonSimulationPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const person = await getRepository().getPerson(slug);
  if (!person) notFound();
  const site = await getTranslations("site");
  return (
    <ScreenSkeleton
      back={{ href: ROUTES.persons, label: site("nav.persons") }}
      title={tr(person.name, locale as Locale)}
      subtitle={tr(person.shortBio, locale as Locale)}
      themeId={await entityTheme(person.eraIds, person.themeId)}
      legacyHref={entityPath("person", person.id)!}
    />
  );
}
