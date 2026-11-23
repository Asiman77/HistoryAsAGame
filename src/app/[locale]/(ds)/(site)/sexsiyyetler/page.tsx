import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { PageHeader } from "@/features/collections/CollectionHeader";
import { personCards } from "@/features/collections/data";
import { PersonsBrowser, type EraFilter } from "@/features/collections/PersonsBrowser";
import { t as tr } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "collections.persons" });
  return { title: t("title"), description: t("lead") };
}

export default async function PersonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("collections");
  const repo = getRepository();
  const [cards, persons, eras] = await Promise.all([personCards(locale as Locale), repo.listPersons(), repo.listEras()]);
  const filters: EraFilter[] = [...eras]
    .sort((a, b) => a.startYear - b.startYear)
    .map((e) => ({ id: e.id, name: tr(e.name, locale as Locale), themeId: e.themeId, personIds: persons.filter((p) => p.eraIds.includes(e.id)).map((p) => p.id) }))
    .filter((e) => e.personIds.length > 0);
  return (
    <>
      <PageHeader title={t("persons.title")} lead={t("persons.lead")} />
      <Container className="pb-24">
        {cards.length ? (
          <Suspense>
            <PersonsBrowser cards={cards} eras={filters} />
          </Suspense>
        ) : (
          <EmptyState description={t("empty")} />
        )}
      </Container>
    </>
  );
}
