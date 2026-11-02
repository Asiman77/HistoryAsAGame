"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { Locale, PlannedEntity } from "@/domain/schema";
import { Divider, Star } from "@/components/Ornament";
import { SettingsButton } from "@/features/settings/SettingsPanel";
import { format, t, type Messages } from "@/lib/i18n";
import { useProgress } from "@/lib/progress";
import { BackdropMap, CollectionStrip, type LandingPerson } from "./Landing";

export type Category = "persons" | "conflicts" | "states";

export interface CategorySummary {
  id: Category;
  /** Titles of simulations that already exist. */
  available: string[];
  /** Announced but not built yet. */
  planned: PlannedEntity[];
}

interface Props {
  locale: Locale;
  messages: Messages;
  categories: CategorySummary[];
  persons: LandingPerson[];
}

/** Home: three sections, each with its own page and cards; all run on the same simulation engine. */
export function Hub({ locale, messages: m, categories, persons }: Props) {
  const reduced = useReducedMotion();
  const progress = useProgress();
  const fade = (i: number) => ({
    initial: reduced ? false : ({ opacity: 0, y: 20 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay: reduced ? 0 : 0.4 + i * 0.12, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <main className="parchment relative min-h-full overflow-x-hidden">
      <BackdropMap />
      <div className="paper-card absolute top-3 right-3 z-20 rounded-lg p-1 sm:top-5 sm:right-5">
        <SettingsButton m={m} />
      </div>

      <section className="relative mx-auto max-w-6xl px-4 pt-14 pb-8 sm:px-8 sm:pt-20">
        <p className="flex items-center justify-center gap-2 text-center text-xs font-medium tracking-[0.25em] text-ink-faint uppercase">
          <Star size={12} className="text-gold" /> {m.landing.kicker} <Star size={12} className="text-gold" />
        </p>
        <motion.h1
          initial={reduced ? false : { opacity: 0, y: 16, letterSpacing: "0.12em" }}
          animate={{ opacity: 1, y: 0, letterSpacing: "0.02em" }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="mt-4 text-center font-display text-5xl font-semibold text-ink sm:text-7xl"
        >
          {m.landing.title}
        </motion.h1>
        <Divider className="mx-auto mt-6 max-w-sm" />
        <p className="text-balance mx-auto mt-6 max-w-2xl text-center font-serif text-lg leading-relaxed text-ink-soft italic sm:text-xl">
          {m.categories.lead}
        </p>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-8" aria-label={m.categories.title}>
        <ul className="grid gap-6 md:grid-cols-3">
          {categories.map((c, i) => {
            const copy = m.categories[c.id];
            return (
              <motion.li key={c.id} {...fade(i)}>
                <Link
                  href={`/${locale}/${c.id}/`}
                  className="group paper-card miniature-frame flex h-full flex-col rounded-md p-6 transition-transform duration-500 ease-out-soft hover:-translate-y-1.5 focus-visible:-translate-y-1.5"
                >
                  <CategoryEmblem id={c.id} />
                  <p className="mt-4 text-[11px] font-semibold tracking-[0.2em] text-ink-faint uppercase">{copy.kicker}</p>
                  <h2 className="mt-1 font-display text-2xl leading-tight font-semibold text-ink">{copy.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{copy.lead}</p>
                  <ul className="mt-4 space-y-1 text-sm">
                    {c.available.map((title) => (
                      <li key={title} className="flex items-center gap-2 text-ink">
                        <span aria-hidden className="text-gold">✦</span> {title}
                      </li>
                    ))}
                    {c.planned.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 text-ink-faint">
                        <span aria-hidden>◇</span> {t(p.title, locale)}
                        <span className="rounded-sm bg-gold/20 px-1.5 text-[10px] font-medium text-[#7a5a17] uppercase">{m.categories.soon}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="mt-auto inline-flex items-center gap-1.5 self-start pt-5 text-sm font-medium text-lapis transition-[gap] group-hover:gap-3">
                    {c.available.length ? format(m.categories.open, { n: c.available.length }) : m.categories.preview} →
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </ul>

        <CollectionStrip persons={persons} progress={progress} locale={locale} m={m} />
        <p className="mt-12 text-center text-sm text-ink-faint">{m.landing.footer}</p>
      </section>
    </main>
  );
}

/** Small miniature-style emblem per section. */
export function CategoryEmblem({ id }: { id: Category }) {
  const ink = "#2a1c10";
  const s = { stroke: ink, strokeWidth: 1.3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 48 48" width="52" height="52" aria-hidden className="drop-shadow-sm">
      <circle cx="24" cy="24" r="22" fill="#f8f0dd" {...s} />
      {id === "persons" && (
        <>
          <path d="M14 20l2.5-8 4.5 4.5L24 9l3 7.5 4.5-4.5L34 20z" fill="#c9a646" {...s} />
          <circle cx="24" cy="27" r="5" fill="#e3d2ab" {...s} />
          <path d="M15 38c1.5-5 5-7 9-7s7.5 2 9 7" fill="#9b2c2c" {...s} />
        </>
      )}
      {id === "conflicts" && (
        <>
          <path d="M13 13l17 17M35 13L18 30" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M13 13l17 17M35 13L18 30" stroke="#f8f0dd" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M28 32l5-5M20 32l-5-5" stroke="#c9a646" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M24 34l1.2 2.5 2.8.4-2 1.9.5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-1.9 2.8-.4z" fill="#9b2c2c" />
        </>
      )}
      {id === "states" && (
        <>
          <path d="M12 16l8-3 8 3 8-3v19l-8 3-8-3-8 3z" fill="#e3d2ab" {...s} />
          <path d="M20 13v19M28 16v19" {...s} />
          <path d="M14 22c3-2 6 1 9-1s5-3 9 0" fill="none" stroke="#9b2c2c" strokeWidth="1.4" strokeDasharray="2 1.5" />
          <circle cx="24" cy="26" r="2" fill="#2d5486" />
        </>
      )}
    </svg>
  );
}
