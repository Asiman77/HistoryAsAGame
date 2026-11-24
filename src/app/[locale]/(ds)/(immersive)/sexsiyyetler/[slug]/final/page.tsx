import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getRepository } from "@/data";
import { loadPoliticalContext } from "@/data/political";
import type { Locale } from "@/domain/schema";
import { personFinal } from "@/features/final/finalAdapter";
import { FinalScreen } from "@/features/final/FinalScreen";
import { buildJourney } from "@/features/simulation/model";
import { formatDate } from "@/lib/dates";
import { getMessages, t as tr } from "@/lib/i18n";

type Params = Promise<{ locale: string; slug: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getRepository().listPersons()).map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const person = await getRepository().getPerson(slug);
  const t = await getTranslations({ locale, namespace: "pages.final" });
  return person ? { title: `${t("title")} · ${tr(person.name, locale as Locale)}`, description: tr(person.legacy, locale as Locale) } : {};
}

/** Legacy, quiz and passport stamps of a person (§6.9, phase 5). */
export default async function PersonFinalPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const repo = getRepository();
  const [person, events, eras, places, snapshots, polities, worldEvents, glossary, registry, themes, relations, persons] = await Promise.all([
    repo.getPerson(slug),
    repo.getEvents(slug),
    repo.listEras(),
    repo.listPlaces(),
    repo.listTerritorySnapshots(),
    repo.listPolities(),
    repo.listWorldEvents(),
    repo.getGlossary(),
    repo.getRegistry(),
    repo.listThemes(),
    repo.getRelations(slug),
    repo.listPersons(),
  ]);
  if (!person || events.length === 0) notFound();
  const political = await loadPoliticalContext(repo, person.birth.date.year, person.death.date.year);
  const journey = buildJourney(person, events, eras, {
    places,
    snapshots,
    polityColors: Object.fromEntries(polities.map((p) => [p.id, p.color])),
    worldEvents,
    glossary,
    registry,
    political,
    themes,
  });
  const m = getMessages(locale as Locale);
  const year = (d: Parameters<typeof formatDate>[0]) => formatDate({ ...d, month: undefined, day: undefined }, m);
  const data = personFinal(journey, locale as Locale, { relations, persons, years: `${year(person.birth.date)} — ${year(person.death.date)}` });
  return <FinalScreen data={data} />;
}
