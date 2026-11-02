import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/data";
import { loadPoliticalContext } from "@/data/political";
import type { Locale } from "@/domain/schema";
import { buildConflictSimulation } from "@/features/conflicts/model";
import { ConflictSimulation } from "@/features/conflicts/ConflictSimulation";
import { getMessages, t } from "@/lib/i18n";

type Params = Promise<{ locale: string; id: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getRepository().listConflicts()).map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const c = await getRepository().getConflict(id);
  return c ? { title: t(c.heading, locale as Locale), description: t(c.description, locale as Locale) } : {};
}

export default async function ConflictPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  const repo = getRepository();
  const [conflict, days, extras, eras, places, snapshots, polities, glossary, registry] = await Promise.all([
    repo.getConflict(id),
    repo.getConflictDays(id),
    repo.getConflictExtras(id),
    repo.listEras(),
    repo.listPlaces(),
    repo.listTerritorySnapshots(),
    repo.listPolities(),
    repo.getGlossary(),
    repo.getRegistry(),
  ]);
  if (!conflict || days.length === 0) notFound();
  const political = await loadPoliticalContext(repo, days[0]!.date.year, days.at(-1)!.date.year);
  const data = buildConflictSimulation(conflict, days, {
    eras,
    places,
    snapshots,
    polityColors: Object.fromEntries(polities.map((p) => [p.id, p.color])),
    glossary,
    registry,
    political,
    ...extras,
  });
  return <ConflictSimulation data={data} locale={locale as Locale} messages={getMessages(locale as Locale)} />;
}
