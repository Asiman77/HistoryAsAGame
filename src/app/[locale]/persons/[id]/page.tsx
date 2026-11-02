import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/data";
import { loadPoliticalContext } from "@/data/political";
import type { Locale } from "@/domain/schema";
import { buildJourney } from "@/features/simulation/model";
import { PersonSimulation } from "@/features/simulation/PersonSimulation";
import { getMessages, t } from "@/lib/i18n";

type Params = Promise<{ locale: string; id: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  const persons = await getRepository().listPersons();
  return persons.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const person = await getRepository().getPerson(id);
  if (!person) return {};
  return { title: t(person.name, locale as Locale), description: t(person.shortBio, locale as Locale) };
}

export default async function PersonPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  const repo = getRepository();
  const [person, events, eras, places, snapshots, polities, worldEvents, glossary, registry] = await Promise.all([
    repo.getPerson(id),
    repo.getEvents(id),
    repo.listEras(),
    repo.listPlaces(),
    repo.listTerritorySnapshots(),
    repo.listPolities(),
    repo.listWorldEvents(),
    repo.getGlossary(),
    repo.getRegistry(),
  ]);
  const themes = await repo.listThemes();
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

  return <PersonSimulation journey={journey} locale={locale as Locale} messages={getMessages(locale as Locale)} />;
}
