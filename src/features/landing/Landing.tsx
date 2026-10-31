"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Era, Locale, Person } from "@/domain/schema";
import { Divider, Star } from "@/components/Ornament";
import { format, t, type Messages } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import { withBasePath } from "@/lib/basePath";

export interface LandingPerson {
  person: Person;
  eventCount: number;
}

interface Props {
  locale: Locale;
  persons: LandingPerson[];
  eras: Era[];
  messages: Messages;
}

export function Landing({ locale, persons, eras, messages: m }: Props) {
  const [eraId, setEraId] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const visible = useMemo(
    () => persons.filter(({ person }) => !eraId || person.eraIds.includes(eraId)),
    [persons, eraId],
  );
  const eraById = useMemo(() => new Map(eras.map((e) => [e.id, e])), [eras]);

  return (
    <main className="parchment relative min-h-full overflow-x-hidden">
      <BackdropMap />

      <section className="relative mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-8 sm:pt-20">
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center gap-2 text-center text-xs font-medium tracking-[0.25em] text-ink-faint uppercase"
        >
          <Star size={12} className="text-gold" /> {m.landing.kicker} <Star size={12} className="text-gold" />
        </motion.p>
        <motion.h1
          initial={reduced ? false : { opacity: 0, y: 16, letterSpacing: "0.12em" }}
          animate={{ opacity: 1, y: 0, letterSpacing: "0.02em" }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="mt-4 text-center font-display text-5xl font-semibold text-ink sm:text-7xl"
        >
          {m.landing.title}
        </motion.h1>
        <motion.div
          initial={reduced ? false : { opacity: 0, scaleX: 0.4 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Divider className="mx-auto mt-6 max-w-sm" />
        </motion.div>
        <motion.p
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="text-balance mx-auto mt-6 max-w-2xl text-center font-serif text-lg leading-relaxed text-ink-soft italic sm:text-xl"
        >
          {m.landing.lead}
        </motion.p>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-8">
        <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <h2 className="font-display text-2xl text-ink">{m.landing.choose}</h2>
          <div role="group" aria-label={m.landing.allEras} className="flex max-w-full flex-wrap justify-center gap-2">
            <EraChip active={eraId === null} onClick={() => setEraId(null)} label={m.landing.allEras} />
            {eras.map((era) => (
              <EraChip
                key={era.id}
                active={eraId === era.id}
                onClick={() => setEraId(era.id)}
                label={t(era.name, locale)}
                color={era.theme.accent}
              />
            ))}
          </div>
        </div>

        <motion.ul layout={!reduced} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map(({ person, eventCount }, i) => (
              <motion.li
                key={person.id}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.6, delay: reduced ? 0 : 0.5 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              >
                <PersonCard
                  person={person}
                  eventCount={eventCount}
                  eras={person.eraIds.map((id) => eraById.get(id)).filter((e): e is Era => !!e)}
                  locale={locale}
                  m={m}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>

        <p className="mt-12 text-center text-sm text-ink-faint">{m.landing.footer}</p>
      </section>
    </main>
  );
}

function EraChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-300 ${
        active
          ? "border-ink bg-ink text-parchment-light"
          : "border-ink/20 bg-parchment-light/60 text-ink-soft hover:border-ink/50"
      }`}
    >
      {color && <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: color }} />}
      {label}
    </button>
  );
}

function PersonCard({
  person,
  eventCount,
  eras,
  locale,
  m,
}: {
  person: Person;
  eventCount: number;
  eras: Era[];
  locale: Locale;
  m: Messages;
}) {
  const name = t(person.name, locale);
  const accent = eras.at(-1)?.theme.accent ?? "#8a6a2f";
  return (
    <Link
      href={`/${locale}/person/${person.id}/`}
      className="group paper-card miniature-frame relative flex h-full flex-col overflow-hidden rounded-md transition-transform duration-500 ease-out-soft hover:-translate-y-1.5 focus-visible:-translate-y-1.5"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-parchment-dark">
        {person.portrait ? (
          <Image
            src={withBasePath(person.portrait.src)}
            alt={t(person.portrait.alt, locale)}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover object-top transition-[filter,transform] duration-700 ease-out-soft [filter:sepia(0.55)_saturate(0.8)_contrast(0.95)] group-hover:scale-[1.04] group-hover:[filter:none] group-focus-visible:[filter:none]"
          />
        ) : (
          <div className="grid h-full place-items-center font-display text-7xl text-ink-faint">{name[0]}</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-parchment-light">
          <div className="flex flex-wrap gap-1.5">
            {eras.map((era) => (
              <span
                key={era.id}
                className="rounded-sm px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase"
                style={{ background: era.theme.accent }}
              >
                {t(era.name, locale)}
              </span>
            ))}
          </div>
          <h3 className="mt-2 font-display text-2xl leading-tight font-semibold sm:text-3xl">{name}</h3>
          <p className="mt-1 text-sm text-parchment/90">
            {formatDate({ ...person.birth.date, month: undefined, day: undefined }, m)} –{" "}
            {formatDate({ ...person.death.date, month: undefined, day: undefined }, m)}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-sm text-ink-soft">{person.titles.map((x) => t(x, locale)).join(" · ")}</p>
        {person.epigraph && (
          <p className="font-serif text-ink italic">“{t(person.epigraph.text, locale)}”</p>
        )}
        <p className="line-clamp-4 text-sm leading-relaxed text-ink-soft transition-[line-clamp] sm:line-clamp-3 sm:group-hover:line-clamp-none">
          {t(person.shortBio, locale)}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-xs text-ink-faint">{format(m.landing.events, { count: eventCount })}</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium text-parchment-light transition-[gap] duration-300 group-hover:gap-3"
            style={{ background: accent }}
          >
            {format(m.landing.cta, { name: t(person.shortName ?? person.name, locale) })}
            <span aria-hidden>→</span>
          </span>
        </div>
        {person.portrait && (
          <p className="text-[10px] text-ink-faint/80">{format(m.landing.portraitCredit, { license: person.portrait.license })}</p>
        )}
      </div>
    </Link>
  );
}

/** Faint old-map linework behind the hero: graticule and compass rose. */
function BackdropMap() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full text-ink/[0.07]"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 900"
    >
      <defs>
        <pattern id="grat" width="120" height="120" patternUnits="userSpaceOnUse">
          <path d="M120 0H0V120" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1200" height="900" fill="url(#grat)" />
      <g transform="translate(1040 150)" stroke="currentColor" fill="none" strokeWidth="1.2">
        <circle r="90" />
        <circle r="70" strokeDasharray="2 6" />
        <path d="M0-110L12 0 0 110-12 0z M-110 0L0 12 110 0 0-12z" fill="currentColor" />
      </g>
      <path
        d="M80 700 C 260 620, 380 760, 560 680 S 860 560, 1120 640"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="8 10"
        fill="none"
      />
    </svg>
  );
}
