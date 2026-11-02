"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type {
  BattleOutcome,
  Certainty,
  Choice,
  HistoricalDate,
  Locale,
  PrimaryExcerpt,
  Source,
  WorldEvent,
} from "@/domain/schema";
import { EventIcon } from "@/components/EventIcon";
import { GlossaryText } from "@/components/GlossaryText";
import { formatDate } from "@/lib/dates";
import { format, t, type Messages } from "@/lib/i18n";
import { yearDelta } from "@/lib/worldContext";
import { RelatedLinks } from "@/features/engine/RelatedLinks";
import type { Step } from "./model";
import { Narration } from "./Narration";
import type { Mode } from "./useStoredMode";

export type { Mode } from "./useStoredMode";

interface Props {
  step: Step;
  personName: string;
  mode: Mode;
  locale: Locale;
  m: Messages;
  chosen: number | undefined;
  onChoose: (option: number) => void;
  here: { href: string; label: string };
  onPlace: (placeId: string) => void;
}

/** Body of the story panel for a single step. */
export function StoryContent({ step, personName, mode, locale, m, chosen, onChoose, here, onPlace }: Props) {
  const { event } = step;
  const tr = (x: Parameters<typeof t>[0]) => t(x, locale);

  return (
    <article className="flex flex-col gap-4">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-medium tracking-wide text-parchment-light uppercase transition-colors duration-700"
            style={{ background: "var(--mood-accent, var(--color-ink))" }}
            title={`${m.mood[step.mood]}`}
          >
            <EventIcon type={event.type} size={13} />
            {m.sim.types[event.type]}
          </span>
          <span className="font-medium text-ink-soft">{formatDate(event.date, m)}</span>
          <CertaintyBadge certainty={event.date.certainty} m={m} />
        </div>
        <h2 className="mt-3 font-display text-[1.7rem] leading-tight font-semibold text-ink sm:text-3xl">
          {tr(event.title)}
        </h2>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
          <span>
            {event.fromLocation && <>{tr(event.fromLocation.name)} → </>}
            <strong className="font-semibold text-ink">{tr(event.location.name)}</strong>
          </span>
          {step.distanceKm > 0 && <span className="text-ink-faint">· {format(m.sim.distance, { km: step.distanceKm })}</span>}
        </p>
        {mode === "learn" && (event.location.modernName || event.location.approximate) && (
          <p className="mt-1 text-xs text-ink-faint">
            {event.location.modernName && (
              <>
                {m.sim.modernName}: {tr(event.location.modernName)}
              </>
            )}
            {event.location.modernName && event.location.approximate && " · "}
            {event.location.approximate && m.sim.approxPlace}
          </p>
        )}
      </header>

      {event.outcome && (
        <BattleCard outcome={event.outcome} personName={personName} source={event.sources[0]} locale={locale} m={m} />
      )}

      <AnimatePresence mode="wait" initial={false}>
        {mode === "story" ? (
          <motion.section
            key="story"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-2"
          >
            <Badge tone="gold">{m.sim.narrativeBadge}</Badge>
            {event.narrationAudio && <Narration narration={event.narrationAudio} locale={locale} m={m} />}
            <p className="font-serif text-[1.08rem] leading-[1.75] text-ink italic first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-5xl first-letter:leading-[0.9] first-letter:text-carmine first-letter:not-italic">
              <GlossaryText text={tr(event.narrative)} />
            </p>
          </motion.section>
        ) : (
          <motion.section
            key="learn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-3"
          >
            <Badge tone="lapis">{m.sim.factsBadge}</Badge>
            <p className="leading-relaxed text-ink">
              <GlossaryText text={tr(event.factualSummary)} />
            </p>
            <DateDetails date={event.date} locale={locale} m={m} />
            <Sources sources={event.sources} m={m} />
          </motion.section>
        )}
      </AnimatePresence>

      {event.primarySource && <PrimarySourceCard excerpt={event.primarySource} locale={locale} m={m} />}

      <RelatedLinks refs={step.related} locale={locale} m={m} here={here} onPlace={onPlace} />

      {event.choice && <ChoiceCard choice={event.choice} locale={locale} m={m} chosen={chosen} onChoose={onChoose} />}

      {step.world.length > 0 && <WorldPanel year={event.date.year} events={step.world} locale={locale} m={m} />}
    </article>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "gold" | "lapis" }) {
  const cls = tone === "gold" ? "border-gold/60 text-[#7a5a17]" : "border-lapis/40 text-lapis";
  return (
    <span className={`inline-block self-start rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wider uppercase ${cls}`}>
      {children}
    </span>
  );
}

export function CertaintyBadge({ certainty, m }: { certainty: Certainty; m: Messages }) {
  const cls = {
    exact: "bg-turquoise/15 text-turquoise",
    approximate: "bg-gold/20 text-[#7a5a17]",
    disputed: "bg-carmine/12 text-carmine",
  }[certainty];
  return (
    <span className={`rounded-sm px-1.5 py-0.5 font-medium ${cls}`} title={m.sim.certaintyHelp[certainty]}>
      {m.sim.certainty[certainty]}
    </span>
  );
}

function DateDetails({ date, locale, m }: { date: HistoricalDate; locale: Locale; m: Messages }) {
  if (!date.note && !date.alternatives?.length) return null;
  return (
    <div className="rounded border border-ink/10 bg-parchment/60 p-3 text-sm text-ink-soft">
      <p className="text-xs font-medium text-ink">{m.sim.certaintyHelp[date.certainty]}</p>
      {date.note && <p className="mt-1">{t(date.note, locale)}</p>}
      {!!date.alternatives?.length && (
        <>
          <p className="mt-2 text-xs font-semibold tracking-wide text-ink uppercase">{m.sim.alternatives}</p>
          <ul className="mt-1 space-y-1">
            {date.alternatives.map((alt, i) => (
              <li key={i}>
                <span className="font-medium text-ink">{formatDate({ ...alt, certainty: "exact" }, m)}</span>: {t(alt.note, locale)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SourceLink({ s }: { s: Source }) {
  return s.url ? (
    <a href={s.url} target="_blank" rel="noreferrer" className="text-lapis underline decoration-lapis/30 underline-offset-2 hover:decoration-lapis">
      {s.title}
    </a>
  ) : (
    <span className="italic">{s.title}</span>
  );
}

function Sources({ sources, m }: { sources: Source[]; m: Messages }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-ink uppercase">{m.sim.sources}</p>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-ink-soft marker:text-ink-faint">
        {sources.map((s, i) => (
          <li key={i}>
            <SourceLink s={s} />
            {s.author && <span>, {s.author}</span>}
            {s.note && <span className="text-ink-faint"> ({s.note})</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function BattleCard({
  outcome,
  personName,
  source,
  locale,
  m,
}: {
  outcome: BattleOutcome;
  personName: string;
  source: Source | undefined;
  locale: Locale;
  m: Messages;
}) {
  const reduced = useReducedMotion();
  const color = { victory: "#2f7f7a", defeat: "#9b2c2c", inconclusive: "#7a5a17" }[outcome.result];
  const forcesSource = outcome.forcesSource ?? source;
  const side = (who: "own" | "enemy") => {
    const own = who === "own";
    return (
      <div>
        <p className="text-[11px] tracking-wider text-ink-faint uppercase">{own ? m.sim.battle.own : m.sim.battle.enemy}</p>
        <p className="mt-1 font-display text-base leading-tight font-semibold text-ink">
          {t(own ? outcome.ownSide : outcome.enemySide, locale)}
        </p>
        <ul className="mt-1 space-y-0.5 text-xs text-ink-soft" aria-label={m.sim.battle.commanders}>
          {(own ? outcome.commanders.own : outcome.commanders.enemy).map((c, i) => (
            <li key={i}>
              <GlossaryText text={t(c, locale)} />
            </li>
          ))}
        </ul>
        {outcome.forces?.[who] && (
          <p className="mt-1.5 text-xs font-medium text-ink">
            <span className="text-ink-faint">{m.sim.battle.forces}: </span>
            {t(outcome.forces[who]!, locale)}
          </p>
        )}
      </div>
    );
  };
  return (
    <section
      className="relative overflow-hidden rounded-md border border-ink/15 bg-gradient-to-br from-parchment-light to-parchment-dark/60 p-4"
      aria-label={`${personName}: ${m.sim.types.battle}`}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 text-center">
        {side("own")}
        <div className="pt-4 font-display text-sm text-ink-faint italic">{m.sim.battle.vs}</div>
        {side("enemy")}
      </div>
      {outcome.forces && forcesSource && (
        <p className="mt-2 text-center text-[11px] text-ink-faint">
          {m.sim.battle.forcesNote} {m.sim.battle.source}: <SourceLink s={forcesSource} />
        </p>
      )}
      <div className="mt-4 flex items-start gap-3">
        <motion.span
          initial={reduced ? false : { scale: 1.8, opacity: 0, rotate: -14 }}
          animate={{ scale: 1, opacity: 1, rotate: -6 }}
          transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 16 }}
          className="shrink-0 rounded border-2 px-2.5 py-1 font-display text-sm font-bold tracking-widest uppercase"
          style={{ color, borderColor: color }}
        >
          {m.sim.battle.result[outcome.result]}
        </motion.span>
        <div className="text-sm leading-snug text-ink-soft">
          <p className="text-[11px] font-semibold tracking-wider text-ink uppercase">{m.sim.battle.significance}</p>
          <p className="mt-0.5">
            <GlossaryText text={t(outcome.context, locale)} />
          </p>
        </div>
      </div>
      {!!outcome.maneuvers?.length && <p className="mt-3 text-[11px] text-ink-faint italic">{m.map.battleSchematic}</p>}
    </section>
  );
}

function WorldPanel({ year, events, locale, m }: { year: number; events: WorldEvent[]; locale: Locale; m: Messages }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-md border border-lapis/20 bg-lapis/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold tracking-wider text-lapis uppercase">
          <GlobeIcon /> {m.world.title} · {year}
        </span>
        <span aria-hidden className={`text-lapis transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <ul className="space-y-2.5 px-3 pb-3">
          {events.map((w) => {
            const d = yearDelta(w, year);
            const when = d === 0 ? m.world.same : d < 0 ? format(m.world.before, { n: -d }) : format(m.world.after, { n: d });
            return (
              <li key={w.id} className="text-sm">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-ink">
                    {w.year}
                    {w.endYear ? `–${w.endYear}` : ""}: {t(w.title, locale)}
                  </span>
                  <span className="text-[11px] text-ink-faint">
                    {m.world.regions[w.region]} · {when}
                  </span>
                </p>
                <p className="mt-0.5 leading-snug text-ink-soft">{t(w.description, locale)}</p>
                {w.sources[0]?.url && (
                  <a
                    href={w.sources[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-lapis underline decoration-lapis/30 underline-offset-2"
                  >
                    {w.sources[0].title}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  );
}

function PrimarySourceCard({ excerpt, locale, m }: { excerpt: PrimaryExcerpt; locale: Locale; m: Messages }) {
  return (
    <figure className="miniature-frame rounded-md bg-parchment-light p-4">
      <p className="text-[11px] font-semibold tracking-wider text-[#7a5a17] uppercase">{m.primary.title}</p>
      {excerpt.original && (
        <blockquote className="mt-2 font-serif text-ink-soft italic">
          <span className="sr-only">{m.primary.original}: </span>
          {excerpt.original}
        </blockquote>
      )}
      <blockquote className="mt-2 font-serif text-[1.02rem] leading-relaxed text-ink">
        {excerpt.original && <span className="sr-only">{m.primary.translation}: </span>}“{t(excerpt.text, locale)}”
      </blockquote>
      {excerpt.note && <p className="mt-2 text-xs leading-snug text-ink-soft">{t(excerpt.note, locale)}</p>}
      <figcaption className="mt-2 text-xs text-ink-faint">
        — {t(excerpt.attribution, locale)}
        {excerpt.translator && <> · {excerpt.translator}</>} · {m.primary.license}: {excerpt.license} · <SourceLink s={excerpt.source} />
      </figcaption>
    </figure>
  );
}

function ChoiceCard({
  choice,
  locale,
  m,
  chosen,
  onChoose,
}: {
  choice: Choice;
  locale: Locale;
  m: Messages;
  chosen: number | undefined;
  onChoose: (i: number) => void;
}) {
  const [open, setOpen] = useState(chosen !== undefined);
  const answered = chosen !== undefined;
  const reduced = useReducedMotion();

  if (!open)
    return (
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="group flex items-center justify-between gap-3 rounded-md border-2 border-dashed border-carmine/50 bg-carmine/5 px-4 py-3 text-left transition-colors hover:bg-carmine/10"
      >
        <span className="font-display text-lg font-semibold text-carmine">{m.sim.choice.open}</span>
        <span aria-hidden className="text-xl text-carmine transition-transform group-hover:translate-x-1">
          ⟶
        </span>
      </motion.button>
    );

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="overflow-hidden rounded-md border border-carmine/30 bg-parchment-light"
    >
      <div className="p-4">
        <p className="text-[11px] font-semibold tracking-wider text-carmine uppercase">{m.sim.choice.open}</p>
        <p className="mt-1 font-serif text-[1.02rem] leading-relaxed text-ink">
          <GlossaryText text={t(choice.prompt, locale)} />
        </p>
        {!answered && <p className="mt-2 text-xs text-ink-faint">{m.sim.choice.pick}</p>}
        <ul className="mt-3 space-y-2">
          {choice.options.map((opt, i) => {
            const isHistorical = i === choice.historicalOptionIndex;
            const isMine = i === chosen;
            const state = !answered ? "idle" : isHistorical ? "historical" : isMine ? "mine" : "other";
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={answered}
                  onClick={() => onChoose(i)}
                  className={`w-full rounded border px-3 py-2.5 text-left text-sm transition-all duration-300 ${
                    {
                      idle: "border-ink/20 bg-parchment/40 hover:border-ink/60 hover:bg-parchment",
                      historical: "border-turquoise bg-turquoise/10",
                      mine: "border-carmine/60 bg-carmine/5",
                      other: "border-ink/10 opacity-60",
                    }[state]
                  }`}
                >
                  <span className="flex items-start gap-2">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-current text-[11px] font-semibold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">
                      <span className="text-ink">{t(opt.text, locale)}</span>
                      {answered && (
                        <span className="mt-1 block text-xs text-ink-soft">
                          {(isHistorical || isMine) && (
                            <strong className={isHistorical ? "text-turquoise" : "text-carmine"}>
                              {isHistorical ? m.sim.choice.historical : m.sim.choice.yours}
                              {isHistorical && isMine && ` · ${m.sim.choice.yours}`}.{" "}
                            </strong>
                          )}
                          {t(opt.explanation, locale)}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <AnimatePresence>
          {answered && (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4 border-t border-ink/10 pt-3"
            >
              <p className="font-medium text-ink">
                {chosen === choice.historicalOptionIndex ? m.sim.choice.match : m.sim.choice.differ}
              </p>
              <p className="mt-2 text-xs font-semibold tracking-wide text-ink uppercase">{m.sim.choice.why}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                <GlossaryText text={t(choice.why, locale)} />
              </p>
              <p className="mt-3 text-xs text-ink-faint italic">{m.sim.choice.note}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
