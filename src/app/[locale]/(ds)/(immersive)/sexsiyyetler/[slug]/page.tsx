import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { getRepository } from "@/data";
import { loadPoliticalContext } from "@/data/political";
import type { Locale } from "@/domain/schema";
import { buildJourney } from "@/features/simulation/model";
import { personShell } from "@/features/simulation-shell/personAdapter";
import { ShellFallback } from "@/features/simulation-shell/ShellFallback";
import { SimulationShell } from "@/features/simulation-shell/SimulationShell";
import { t as tr } from "@/lib/i18n";

type Params = Promise<{ locale: string; slug: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getRepository().listPersons()).map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const person = await getRepository().getPerson(slug);
  return person ? { title: tr(person.name, locale as Locale), description: tr(person.shortBio, locale as Locale) } : {};
}

/**
 * Person simulation in the new SimulationShell (phase 3). The legacy page
 * (/persons/<id>/) stays until phase 5 completes portraits, final and quiz.
 */
export default async function PersonSimulationPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const repo = getRepository();
  const [person, events, eras, places, snapshots, polities, worldEvents, glossary, registry, themes] = await Promise.all([
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
  const site = await getTranslations("site");
  const legacy = await getTranslations("pages.final");
  const data = personShell(journey, eras, locale as Locale, { back: site("nav.persons"), final: legacy("title") });
  return (
    <Suspense fallback={<ShellFallback title={data.title} subtitle={data.subtitle} />}>
      <SimulationShell data={data} />
    </Suspense>
  );
}
