import type { Metadata } from "next";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { Hub, type CategorySummary } from "@/features/landing/Hub";
import type { LandingPerson } from "@/features/landing/Landing";
import { getMessages, t } from "@/lib/i18n";

export const metadata: Metadata = { title: { absolute: "Tarixin İçində" } };

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  const repo = getRepository();
  const [persons, planned, states, conflicts] = await Promise.all([repo.listPersons(), repo.listPlanned(), repo.listStates(), repo.listConflicts()]);
  const cards: LandingPerson[] = await Promise.all(
    persons.map(async (person) => ({ person, eventCount: (await repo.getEvents(person.id)).length })),
  );
  const categories: CategorySummary[] = [
    { id: "persons", available: persons.map((p) => t(p.shortName ?? p.name, locale)), planned: [] },
    { id: "conflicts", available: conflicts.map((c) => t(c.name, locale)), planned: planned.filter((p) => p.type === "conflict") },
    { id: "states", available: states.map((st) => t(st.name, locale)), planned: planned.filter((p) => p.type === "state") },
  ];
  return <Hub locale={locale} messages={getMessages(locale)} categories={categories} persons={cards} />;
}
