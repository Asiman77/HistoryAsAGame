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
  return (await getRepository().listPersons()).map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const person = await getRepository().getPerson(slug);
  const t = await getTranslations({ locale, namespace: "pages.final" });
  return person ? { title: `${t("title")} · ${tr(person.name, locale as Locale)}` } : {};
}

/** Legacy, quiz and passport of a person (phase 5). */
export default async function PersonFinalPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const person = await getRepository().getPerson(slug);
  if (!person) notFound();
  const t = await getTranslations("pages.final");
  const name = tr(person.name, locale as Locale);
  return (
    <ScreenSkeleton
      back={{ href: `/sexsiyyetler/${person.id}/`, label: name }}
      eyebrow={t("eyebrow")}
      title={`${t("title")}: ${name}`}
      themeId={await entityTheme(person.eraIds, person.themeId)}
      legacyHref={entityPath("person", person.id)!}
    />
  );
}
