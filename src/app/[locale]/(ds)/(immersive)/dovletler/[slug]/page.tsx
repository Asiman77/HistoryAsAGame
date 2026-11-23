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
  return (await getRepository().listStates()).map((s) => ({ slug: s.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const state = await getRepository().getState(slug);
  return state ? { title: tr(state.name, locale as Locale) } : {};
}

/** State simulation (phase 8). */
export default async function StateSimulationPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const state = await getRepository().getState(slug);
  if (!state) notFound();
  const site = await getTranslations("site");
  return (
    <ScreenSkeleton
      back={{ href: ROUTES.states, label: site("nav.states") }}
      eyebrow={state.years}
      title={tr(state.name, locale as Locale)}
      subtitle={tr(state.description, locale as Locale)}
      themeId={await entityTheme(state.eraIds)}
      legacyHref={entityPath("state", state.id)!}
    />
  );
}
