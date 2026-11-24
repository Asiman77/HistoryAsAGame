import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AtmosphereBackground } from "@/components/atmosphere/AtmosphereBackground";
import { Container } from "@/components/layout/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { PassportBook, type PassportEntry } from "@/features/passport/PassportBook";
import { journeyStamps } from "@/features/passport/stamps";
import { buildJourney } from "@/features/simulation/model";
import { t as tr } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "pages.passport" });
  return { title: t("title") };
}

/** Tarix pasportu: the stamps earned in the simulations (§6.9), stored on this device only. */
export default async function PassportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.passport");
  const repo = getRepository();
  const [persons, eras, places, themes] = await Promise.all([repo.listPersons(), repo.listEras(), repo.listPlaces(), repo.listThemes()]);
  // Every place a simulation can stamp, named as the story names it (first simulation wins).
  const entries = new Map<string, PassportEntry>();
  const sims: Record<string, { title: string; href: string }> = {};
  for (const person of persons) {
    const events = await repo.getEvents(person.id);
    if (!events.length) continue;
    const journey = buildJourney(person, events, eras, {
      places,
      snapshots: [],
      polityColors: {},
      worldEvents: [],
      glossary: [],
      registry: {},
      political: { polities: [], rulers: [], reigns: [] },
      themes,
    });
    sims[person.id] = { title: tr(person.name, locale as Locale), href: `/sexsiyyetler/${person.id}/` };
    for (const s of journeyStamps(journey, locale as Locale)) if (!entries.has(s.id)) entries.set(s.id, { id: s.id, name: s.name });
  }
  return (
    <section className="relative isolate flex flex-1 flex-col overflow-hidden" data-testid="passport-page">
      <AtmosphereBackground silhouette="mountains" pattern={0.06} glow={{ x: "80%", y: "10%", strength: 0.16 }} />
      <Container className="flex flex-col gap-6 pb-40 pt-14">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1 className="m-0 font-heading text-44 font-medium leading-tight text-fg md:text-60">{t("title")}</h1>
        <PassportBook entries={[...entries.values()]} sims={sims} />
      </Container>
    </section>
  );
}
