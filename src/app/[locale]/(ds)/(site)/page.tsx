import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getRepository } from "@/data";
import { resolveRef } from "@/domain/registry";
import type { Locale } from "@/domain/schema";
import { PersonCard, SimCard } from "@/features/collections/cards";
import { conflictCards, contentCounts, personCards, stateCards } from "@/features/collections/data";
import { heroRoute, timelinePreview } from "@/features/home/data";
import { Hero } from "@/features/home/Hero";
import { OnThisDayPanel, type OnThisDayEvent, type SpecialDay } from "@/features/home/OnThisDayPanel";
import { TimelinePreview } from "@/features/home/TimelinePreview";
import { Ways } from "@/features/home/Ways";
import { getMessages as legacyMessages, t } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: { absolute: "Tarixin İçində" } };

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Locale;
  const tr = await getTranslations("home");
  const repo = getRepository();
  const [persons, conflicts, states, counts, route, preview, index, commemorations, registry] = await Promise.all([
    personCards(locale),
    conflictCards(locale),
    stateCards(locale),
    contentCounts(),
    heroRoute(locale),
    timelinePreview(locale),
    repo.getHistoryIndex(),
    repo.listCommemorations(),
    repo.getRegistry(),
  ]);

  const events: OnThisDayEvent[] = index
    .filter((e) => e.date.month !== undefined)
    .map((e) => ({ key: e.key, href: e.href, title: t(e.title, locale), entityTitle: t(e.entityTitle, locale), date: e.date, claimType: e.claimType }));
  const specials: SpecialDay[] = commemorations.map((c) => {
    const ref = c.ref ? resolveRef(c.ref, registry) : null;
    return {
      id: c.id,
      month: c.month,
      day: c.day,
      style: c.style,
      title: t(c.title, locale),
      description: t(c.description, locale),
      ref: ref?.href ? { href: ref.href, label: t(ref.stepTitle ?? ref.title, locale) } : null,
    };
  });

  return (
    <>
      <Hero route={route} counts={counts} />
      <Ways />

      <section aria-labelledby="persons-title" className="py-16">
        <Container className="flex flex-col gap-10">
          <SectionHeading id="persons-title" eyebrow={tr("persons.eyebrow")} title={tr("persons.title")} action={{ href: ROUTES.persons, label: tr("persons.all") }} />
          <ul className="m-0 grid list-none gap-5 p-0 md:grid-cols-2 lg:grid-cols-3">
            {persons.map((card) => (
              <li key={card.id}>
                <PersonCard card={card} />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-label={`${tr("conflicts.eyebrow")}, ${tr("states.eyebrow")}`} className="py-16">
        <Container className="grid gap-5 lg:grid-cols-2">
          {conflicts.map((card) => (
            <SimCard key={card.id} card={card} eyebrow={tr("conflicts.eyebrow")} action={tr("conflicts.start")} variant="war" progressKey={`conflict:${card.id}`} />
          ))}
          {states.map((card) => (
            <SimCard key={card.id} card={card} eyebrow={tr("states.eyebrow")} action={tr("states.start")} variant="state" progressKey={`state:${card.id}`} />
          ))}
        </Container>
      </section>

      <section aria-label={tr("timeline.title")} className="pb-24 pt-16">
        <Container className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <TimelinePreview data={preview} initialYear={route?.[1].year ?? preview.from} />
          <OnThisDayPanel events={events} specials={specials} months={legacyMessages(locale).months} />
        </Container>
      </section>
    </>
  );
}
