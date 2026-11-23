import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { PeriodTheme } from "@/components/layout/PeriodTheme";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { SimCard } from "@/features/collections/cards";
import { PageHeader } from "@/features/collections/CollectionHeader";
import { stateCards } from "@/features/collections/data";
import { listTheme } from "@/features/collections/theme";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "collections.states" });
  return { title: t("title"), description: t("lead") };
}

export default async function StatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("collections");
  const home = await getTranslations("home");
  const [cards, theme] = await Promise.all([stateCards(locale as Locale), getRepository().listStates().then(listTheme)]);
  return (
    <>
      <PeriodTheme id={theme} />
      <PageHeader title={t("states.title")} lead={t("states.lead")} />
      <Container className="pb-24">
        {cards.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {cards.map((card) => (
              <SimCard key={card.id} card={card} eyebrow={t("steps", { n: card.steps })} action={home("states.start")} variant="state" progressKey={`state:${card.id}`} />
            ))}
          </div>
        ) : (
          <EmptyState description={t("empty")} />
        )}
      </Container>
    </>
  );
}
