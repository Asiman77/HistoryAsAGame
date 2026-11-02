import type { Metadata } from "next";
import Link from "next/link";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { Divider } from "@/components/Ornament";
import { ThemeShell } from "@/features/theme/ThemeShell";
import { format, getMessages, t } from "@/lib/i18n";
import { DEFAULT_THEME_ID } from "@/lib/theme";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getMessages((await params).locale as Locale).places.title };
}

/** Every catalogue place; those with simulation steps first, with how many. */
export default async function PlacesIndex({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  const m = getMessages(locale);
  const repo = getRepository();
  const [places, index, themes] = await Promise.all([repo.listPlaces(), repo.getHistoryIndex(), repo.listThemes()]);
  const counts = new Map<string, number>();
  for (const e of index) if (e.placeId) counts.set(e.placeId, (counts.get(e.placeId) ?? 0) + 1);
  const name = (id: string) => t(places.find((p) => p.id === id)!.names.historical, locale);
  const withEvents = places.filter((p) => counts.has(p.id)).sort((a, b) => counts.get(b.id)! - counts.get(a.id)! || name(a.id).localeCompare(name(b.id), "az"));
  const others = places.filter((p) => !counts.has(p.id)).sort((a, b) => name(a.id).localeCompare(name(b.id), "az"));

  return (
    <ThemeShell theme={themes[DEFAULT_THEME_ID]!}>
      <main className="relative min-h-full overflow-x-hidden">
        <nav className="p-3 sm:p-5">
          <Link href={`/${locale}/`} className="paper-card rounded-full px-3 py-1.5 text-sm text-ink-soft hover:text-ink">
            ← {m.categories.home}
          </Link>
        </nav>
        <section className="mx-auto max-w-5xl px-4 pb-6 text-center sm:px-8">
          <p className="text-xs font-semibold tracking-[0.25em] text-ink-faint uppercase">{m.places.kicker}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-ink sm:text-5xl">{m.places.title}</h1>
          <Divider className="mx-auto mt-5 max-w-xs" />
          <p className="mx-auto mt-4 max-w-2xl font-serif text-lg text-ink-soft italic">{m.places.lead}</p>
        </section>
        <section className="mx-auto max-w-5xl px-4 pb-8 sm:px-8">
          <h2 className="font-display text-2xl font-semibold text-ink">{m.places.withEvents}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {withEvents.map((p) => (
              <li key={p.id}>
                <Link href={`/${locale}/places/${p.id}/`} className="paper-card flex h-full items-baseline justify-between gap-2 rounded-md px-4 py-3 hover:-translate-y-0.5 transition-transform">
                  <span>
                    <span className="font-display text-lg font-semibold text-ink">{name(p.id)}</span>
                    {p.names.modern && <span className="block text-xs text-ink-faint">{t(p.names.modern, locale)}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-ink-soft">{format(m.places.eventsCount, { n: counts.get(p.id)! })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-8">
          <h2 className="font-display text-xl font-semibold text-ink">{m.places.others}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {others.map((p) => (
              <li key={p.id}>
                <Link href={`/${locale}/places/${p.id}/`} className="inline-block rounded-full border border-ink/20 px-3 py-1 text-sm text-ink-soft hover:border-ink hover:text-ink">
                  {name(p.id)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </ThemeShell>
  );
}
