"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { BattleOutcome, Certainty, Choice, HistoricalDate, Locale, Source } from "@/domain/schema";
import { EventIcon } from "@/components/EventIcon";
import { formatDate } from "@/lib/dates";
import { format, t, type Messages } from "@/lib/i18n";
import type { Step } from "./model";

export type Mode = "story" | "learn";

interface Props {
  step: Step;
  personName: string;
  mode: Mode;
  locale: Locale;
  m: Messages;
  chosen: number | undefined;
  onChoose: (option: number) => void;
}

/** Body of the story panel for a single step. */
export function StoryContent({ step, personName, mode, locale, m, chosen, onChoose }: Props) {
  const { event } = step;
  const tr = (x: Parameters<typeof t>[0]) => t(x, locale);

  return (
    <article className="flex flex-col gap-4">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-2 py-1 font-medium tracking-wide text-parchment-light uppercase">
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

      {event.outcome && <BattleCard outcome={event.outcome} personName={personName} locale={locale} m={m} />}

      <AnimatePresence mode="wait" initial={false}>
        {mode === "story" ? (
          <motion.section
            key="story"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Badge tone="gold">{m.sim.narrativeBadge}</Badge>
            <p className="mt-2 font-serif text-[1.08rem] leading-[1.75] text-ink italic first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-5xl first-letter:leading-[0.9] first-letter:text-carmine first-letter:not-italic">
              {tr(event.narrative)}
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
            <p className="leading-relaxed text-ink">{tr(event.factualSummary)}</p>
            <DateDetails date={event.date} locale={locale} m={m} />
            <Sources sources={event.sources} m={m} />
          </motion.section>
        )}
      </AnimatePresence>

      {event.choice && <ChoiceCard choice={event.choice} locale={locale} m={m} chosen={chosen} onChoose={onChoose} />}
    </article>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "gold" | "lapis" }) {
  const cls = tone === "gold" ? "border-gold/60 text-gold" : "border-lapis/40 text-lapis";
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

function Sources({ sources, m }: { sources: Source[]; m: Messages }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-ink uppercase">{m.sim.sources}</p>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-ink-soft marker:text-ink-faint">
        {sources.map((s, i) => (
          <li key={i}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer" className="text-lapis underline decoration-lapis/30 underline-offset-2 hover:decoration-lapis">
                {s.title}
              </a>
            ) : (
              <span className="italic">{s.title}</span>
            )}
            {s.author && <span>, {s.author}</span>}
            {s.note && <span className="text-ink-faint"> ({s.note})</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function BattleCard({ outcome, personName, locale, m }: { outcome: BattleOutcome; personName: string; locale: Locale; m: Messages }) {
  const reduced = useReducedMotion();
  const color = { victory: "#2f7f7a", defeat: "#9b2c2c", inconclusive: "#7a5a17" }[outcome.result];
  return (
    <section className="relative overflow-hidden rounded-md border border-ink/15 bg-gradient-to-br from-parchment-light to-parchment-dark/60 p-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 text-center">
        <div>
          <p className="text-[11px] tracking-wider text-ink-faint uppercase">{m.sim.battle.own}</p>
          <p className="mt-1 font-display text-base leading-tight font-semibold text-ink">{personName}</p>
          {outcome.forces?.own && <p className="mt-1 text-xs text-ink-soft">{t(outcome.forces.own, locale)}</p>}
        </div>
        <div className="pt-3 font-display text-sm text-ink-faint italic">{m.sim.battle.vs}</div>
        <div>
          <p className="text-[11px] tracking-wider text-ink-faint uppercase">{m.sim.battle.enemy}</p>
          <p className="mt-1 font-display text-base leading-tight font-semibold text-ink">{t(outcome.opponent, locale)}</p>
          {outcome.forces?.enemy && <p className="mt-1 text-xs text-ink-soft">{t(outcome.forces.enemy, locale)}</p>}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <motion.span
          initial={reduced ? false : { scale: 1.8, opacity: 0, rotate: -14 }}
          animate={{ scale: 1, opacity: 1, rotate: -6 }}
          transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 16 }}
          className="shrink-0 rounded border-2 px-2.5 py-1 font-display text-sm font-bold tracking-widest uppercase"
          style={{ color, borderColor: color }}
        >
          {m.sim.battle.result[outcome.result]}
        </motion.span>
        <p className="text-sm leading-snug text-ink-soft">{t(outcome.context, locale)}</p>
      </div>
    </section>
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
        <p className="mt-1 font-serif text-[1.02rem] leading-relaxed text-ink">{t(choice.prompt, locale)}</p>
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
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{t(choice.why, locale)}</p>
              <p className="mt-3 text-xs text-ink-faint italic">{m.sim.choice.note}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
