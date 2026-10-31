import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { buildJourney } from "@/features/simulation/model";
import { SimulationView } from "@/features/simulation/SimulationView";
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
  const [person, events, eras] = await Promise.all([repo.getPerson(id), repo.getEvents(id), repo.listEras()]);
  if (!person || events.length === 0) notFound();

  return (
    <SimulationView
      journey={buildJourney(person, events, eras)}
      locale={locale as Locale}
      messages={getMessages(locale as Locale)}
    />
  );
}
