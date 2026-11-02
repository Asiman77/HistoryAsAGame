import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/data";
import { loadPoliticalContext } from "@/data/political";
import type { Locale } from "@/domain/schema";
import { buildStateSimulation } from "@/features/states/model";
import { StateSimulation } from "@/features/states/StateSimulation";
import { getMessages, t } from "@/lib/i18n";

type Params = Promise<{ locale: string; id: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getRepository().listStates()).map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const state = await getRepository().getState(id);
  return state ? { title: t(state.name, locale as Locale), description: t(state.description, locale as Locale) } : {};
}

export default async function StatePage({ params }: { params: Params }) {
  const { locale, id } = await params;
  const repo = getRepository();
  const [state, stages, eras, places, snapshots, polities, worldEvents, glossary, registry] = await Promise.all([
    repo.getState(id),
    repo.getStateSteps(id),
    repo.listEras(),
    repo.listPlaces(),
    repo.listTerritorySnapshots(),
    repo.listPolities(),
    repo.listWorldEvents(),
    repo.getGlossary(),
    repo.getRegistry(),
  ]);
  if (!state || stages.length === 0) notFound();
  const political = await loadPoliticalContext(repo, stages[0]!.date.year, stages.at(-1)!.date.year);
  const data = buildStateSimulation(state, stages, {
    eras,
    places,
    snapshots,
    polityColors: Object.fromEntries(polities.map((p) => [p.id, p.color])),
    worldEvents,
    glossary,
    registry,
    political,
  });
  return <StateSimulation data={data} locale={locale as Locale} messages={getMessages(locale as Locale)} />;
}
