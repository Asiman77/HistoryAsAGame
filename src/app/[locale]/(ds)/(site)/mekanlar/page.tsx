import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import type { Locale } from "@/domain/schema";
import { PlaceCard } from "@/features/collections/cards";
import { PageHeader } from "@/features/collections/CollectionHeader";
import { placeGroups } from "@/features/collections/data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "collections.places" });
  return { title: t("title"), description: t("lead") };
}

export default async function PlacesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("collections.places");
  const groups = await placeGroups(locale as Locale);
  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <Container className="flex flex-col gap-12 pb-24">
        {groups.map((g) => (
          <section key={g.type} aria-labelledby={`places-${g.type}`} className="flex flex-col gap-4">
            <h2 id={`places-${g.type}`} className="m-0 font-heading text-26 font-medium text-fg">
              {t(`types.${g.type}`)}
            </h2>
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {g.places.map((p) => (
                <li key={p.id}>
                  <PlaceCard place={p} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Container>
    </>
  );
}
