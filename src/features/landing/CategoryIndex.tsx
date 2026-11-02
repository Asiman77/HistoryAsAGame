"use client";

import Link from "next/link";
import type { Locale, PlannedEntity, Theme } from "@/domain/schema";
import { ThemeShell } from "@/features/theme/ThemeShell";
import { ArtCredit } from "@/features/theme/Atmosphere";
import { Divider } from "@/components/Ornament";
import { SettingsButton } from "@/features/settings/SettingsPanel";
import { t, type Messages } from "@/lib/i18n";
import { BackdropMap } from "./Landing";
import { CategoryEmblem, type Category } from "./Hub";

export interface CategoryItem {
  id: string;
  title: string;
  description: string;
  years?: string;
}

interface Props {
  category: Exclude<Category, "persons">;
  items: CategoryItem[];
  planned: PlannedEntity[];
  locale: Locale;
  messages: Messages;
  theme: Theme;
}

/** List page for conflicts and states: built simulations as links, announced ones as "tezliklə" cards. */
export function CategoryIndex({ category, items, planned, locale, messages: m, theme }: Props) {
  const copy = m.categories[category];
  return (
    <ThemeShell theme={theme}>
    <main className="relative min-h-full overflow-x-hidden">
      <BackdropMap />
      <Link
        href={`/${locale}/`}
        className="paper-card absolute top-3 left-3 z-20 rounded-full px-3 py-1.5 text-sm text-ink-soft hover:text-ink sm:top-5 sm:left-5"
      >
        ← {m.categories.home}
      </Link>
      <div className="paper-card absolute top-3 right-3 z-20 rounded-lg p-1 sm:top-5 sm:right-5">
        <SettingsButton m={m} />
      </div>

      <section className="relative mx-auto max-w-4xl px-4 pt-20 pb-8 text-center sm:px-8">
        <div className="flex justify-center">
          <CategoryEmblem id={category} />
        </div>
        <p className="mt-4 text-xs font-semibold tracking-[0.25em] text-ink-faint uppercase">{copy.kicker}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-ink sm:text-5xl">{copy.title}</h1>
        <Divider className="mx-auto mt-5 max-w-xs" />
        <p className="text-balance mx-auto mt-5 max-w-2xl font-serif text-lg text-ink-soft italic">{copy.lead}</p>
      </section>

      <section className="relative mx-auto max-w-4xl px-4 pb-16 sm:px-8">
        <ul className="grid gap-5 sm:grid-cols-2">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/${locale}/${category}/${it.id}/`}
                className="paper-card miniature-frame flex h-full flex-col rounded-md p-6 transition-transform duration-500 hover:-translate-y-1"
              >
                {it.years && <p className="text-xs text-ink-faint">{it.years}</p>}
                <h2 className="font-display text-2xl font-semibold text-ink">{it.title}</h2>
                <p className="mt-2 text-sm text-ink-soft">{it.description}</p>
              </Link>
            </li>
          ))}
          {planned.map((p) => (
            <li key={p.id}>
              <div className="paper-card flex h-full flex-col rounded-md border border-dashed border-ink/20 p-6 opacity-90" aria-disabled="true">
                <p className="flex items-center gap-2 text-xs text-ink-faint">
                  {p.years}
                  <span className="rounded-sm bg-gold/20 px-1.5 text-[10px] font-medium text-[#7a5a17] uppercase">{m.categories.soon}</span>
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-ink-soft">{t(p.title, locale)}</h2>
                {p.description && <p className="mt-2 text-sm text-ink-faint">{t(p.description, locale)}</p>}
              </div>
            </li>
          ))}
        </ul>
        {items.length === 0 && planned.length === 0 && <p className="text-center text-ink-faint">{m.categories.empty}</p>}
      </section>
      <div className="relative pb-8">
        <ArtCredit theme={theme} locale={locale} label={m.theme} />
      </div>
    </main>
    </ThemeShell>
  );
}
