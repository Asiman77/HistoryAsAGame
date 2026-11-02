import type { Metadata } from "next";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { Landing, type LandingPerson } from "@/features/landing/Landing";
import { getMessages } from "@/lib/i18n";
import { eraViews, pickThemes } from "@/lib/theme";

export const metadata: Metadata = { title: "Tarixi şəxsiyyətlər" };

export default async function PersonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  const repo = getRepository();
  const [persons, allEras, allThemes] = await Promise.all([repo.listPersons(), repo.listEras(), repo.listThemes()]);
  const eras = allEras.filter((e) => persons.some((p) => p.eraIds.includes(e.id)));
  const cards: LandingPerson[] = await Promise.all(
    persons.map(async (person) => ({ person, eventCount: (await repo.getEvents(person.id)).length })),
  );
  const m = getMessages(locale);
  return (
    <Landing
      locale={locale}
      persons={cards}
      eras={eraViews(eras, allThemes)}
      themes={pickThemes(allThemes, eras.map((e) => e.themeId))}
      messages={m}
      heading={{ kicker: m.categories.persons.kicker, title: m.categories.persons.title, lead: m.categories.persons.lead }}
      backHref={`/${locale}/`}
    />
  );
}
