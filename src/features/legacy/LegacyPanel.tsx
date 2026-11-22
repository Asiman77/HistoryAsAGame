"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Locale, QuizQuestion } from "@/domain/schema";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Divider } from "@/components/Ornament";
import { formatDate } from "@/lib/dates";
import { format, t, type Messages } from "@/lib/i18n";
import type { Journey } from "@/features/simulation/model";
import { getAudioEngine } from "@/features/audio/engine";
import { withBasePath } from "@/lib/basePath";
import { recordQuiz, useProgress } from "@/lib/progress";
import { classifyItems } from "@/lib/claims";
import { FactOrLegendQuiz } from "@/features/claims/FactOrLegendQuiz";
import { ownerOf, track } from "@/lib/analytics/client";
import { useAnalyticsOwner } from "@/lib/analytics/context";
import type { TrackedQuizQuestion } from "@/lib/analytics/quiz";

const MAX_QUESTIONS = 6;

interface Props {
  journey: Journey;
  choices: Record<string, number>;
  locale: Locale;
  m: Messages;
  /** Teacher mode: the class answers together and the teacher reveals the answer. */
  teacher: boolean;
  onRestart: () => void;
  onBack: () => void;
}

export function LegacyPanel({ journey, choices, locale, m, teacher, onRestart, onBack }: Props) {
  const { person, stats, steps } = journey;
  const reduced = useReducedMotion();
  const lastAge = steps.at(-1)!.age;
  const choiceSteps = steps.filter((s) => s.event.choice);
  const answered = choiceSteps.filter((s) => choices[s.event.id] !== undefined);
  const matched = answered.filter((s) => choices[s.event.id] === s.event.choice!.historicalOptionIndex);

  const item = (i: number) => ({
    initial: reduced ? false : ({ opacity: 0, y: 12 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { delay: reduced ? 0 : 0.3 + i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <div className="flex flex-col gap-5">
      <motion.header {...item(0)}>
        <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{m.legacy.title}</p>
        <h2 className="mt-1 font-display text-3xl font-semibold text-ink">{t(person.name, locale)}</h2>
        <p className="text-sm text-ink-soft">
          {format(m.legacy.lived, { from: formatDate(person.birth.date, m), to: formatDate(person.death.date, m) })}
        </p>
      </motion.header>

      <motion.div {...item(1)}>
        <EarnedCard journey={journey} locale={locale} m={m} />
      </motion.div>

      <motion.p {...item(1)} className="font-serif text-[1.05rem] leading-relaxed text-ink">
        {t(person.legacy, locale)}
      </motion.p>

      <motion.section {...item(2)}>
        <Divider className="mb-4" />
        <h3 className="mb-3 text-xs font-semibold tracking-wider text-ink uppercase">{m.legacy.stats}</h3>
        <dl className="grid grid-cols-2 gap-3">
          <Stat label={m.legacy.distance} help={m.legacy.distanceNote}>
            <AnimatedNumber value={stats.distanceKm} /> <span className="text-base font-normal">{m.legacy.km}</span>
          </Stat>
          <Stat label={m.legacy.battles}>
            <AnimatedNumber value={stats.battles} />
            <span className="mt-0.5 block text-xs font-normal text-ink-soft">
              {format(m.legacy.victories, { n: stats.victories })} · {format(m.legacy.defeats, { n: stats.defeats })}
            </span>
          </Stat>
          <Stat label={m.legacy.places}>
            <AnimatedNumber value={stats.placeCount} />
          </Stat>
          <Stat label={m.legacy.years}>
            {lastAge.approximate && "~"}
            <AnimatedNumber value={lastAge.years} />
          </Stat>
          {stats.choiceCount > 0 && (
            <Stat label={m.legacy.choices} wide>
              <span className="text-lg">{format(m.legacy.choicesValue, { match: matched.length, total: stats.choiceCount })}</span>
            </Stat>
          )}
        </dl>
      </motion.section>

      {journey.quiz.length > 0 && (
        <motion.section {...item(3)}>
          <Quiz questions={journey.quiz} locale={locale} m={m} teacher={teacher} onFinish={(score, total) => recordQuiz(person.id, score, total)} />
        </motion.section>
      )}

      <motion.section {...item(3)}>
        <FactOrLegendQuiz items={classifyItems(journey.steps)} locale={locale} m={m} />
      </motion.section>

      <motion.div {...item(4)} className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={onRestart} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-parchment-light hover:bg-ink-soft">
          {m.legacy.restart}
        </button>
        <Link href={`/${locale}/persons/`} className="rounded-full border border-ink/30 px-4 py-2 text-sm font-medium text-ink hover:border-ink">
          {m.legacy.others}
        </Link>
        <Link
          href={`/${locale}/compare/?a=person:${person.id}`}
          className="rounded-full border border-ink/30 px-4 py-2 text-sm font-medium text-ink hover:border-ink"
          data-testid="legacy-compare"
        >
          {m.compare.withOther}
        </Link>
        <button type="button" onClick={onBack} className="px-2 py-2 text-sm text-ink-soft underline underline-offset-2">
          {m.legacy.backToJourney}
        </button>
      </motion.div>
    </div>
  );
}

function Stat({ label, children, help, wide }: { label: string; children: React.ReactNode; help?: string; wide?: boolean }) {
  return (
    <div className={`rounded-md border border-ink/10 bg-parchment/50 p-3 ${wide ? "col-span-2" : ""}`} title={help}>
      <dt className="text-[11px] tracking-wider text-ink-faint uppercase">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold text-ink">{children}</dd>
    </div>
  );
}

/** Deterministic pick so the static page and the client agree, spread across the life. */
function pickQuestions<Q extends QuizQuestion>(all: Q[]): Q[] {
  if (all.length <= MAX_QUESTIONS) return all;
  const step = all.length / MAX_QUESTIONS;
  return Array.from({ length: MAX_QUESTIONS }, (_, i) => all[Math.floor(i * step)]!);
}

export function Quiz({
  questions: all,
  locale,
  m,
  teacher,
  onFinish,
}: {
  questions: TrackedQuizQuestion[];
  locale: Locale;
  m: Messages;
  teacher: boolean;
  onFinish: (score: number, total: number) => void;
}) {
  const owner = useAnalyticsOwner();
  const questions = useMemo(() => pickQuestions(all), [all]);
  const [started, setStarted] = useState(false);
  const [qi, setQi] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  /** Teacher mode: the option the class settled on, before the answer is revealed. */
  const [classPick, setClassPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const done = qi >= questions.length;
  const q = questions[qi];

  if (!started)
    return (
      <div className="rounded-md border border-lapis/25 bg-lapis/5 p-4">
        <h3 className="font-display text-xl font-semibold text-lapis">{m.legacy.quiz}</h3>
        {teacher && <p className="mt-1 text-sm text-ink-soft">{m.legacy.teacherHint}</p>}
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="mt-3 rounded-full bg-lapis px-4 py-2 text-sm font-medium text-parchment-light hover:bg-lapis-light"
        >
          {m.legacy.quizStart}
        </button>
      </div>
    );

  if (done) {
    const ratio = score / questions.length;
    return (
      <div className="rounded-md border border-lapis/25 bg-lapis/5 p-4" role="status">
        <h3 className="font-display text-xl font-semibold text-lapis">{m.legacy.quiz}</h3>
        <p className="mt-2 font-display text-3xl font-semibold text-ink">{format(m.legacy.score, { score, total: questions.length })}</p>
        <p className="mt-1 text-ink-soft">
          {ratio >= 0.8 ? m.legacy.scoreGreat : ratio >= 0.5 ? m.legacy.scoreGood : m.legacy.scoreLow}
        </p>
        {score === questions.length && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-gold bg-gold/15 px-3 py-1 text-sm font-medium text-[#7a5a17]">
            <span aria-hidden>✦</span> {m.legacy.badgeEarned}
          </p>
        )}
      </div>
    );
  }

  const reveal = (i: number) => {
    setAnswer(i);
    if (owner && q!.stepKey !== undefined) {
      track({ type: "quiz_answered", ...ownerOf(owner.key), stepKey: q!.stepKey, questionIndex: q!.questionIndex, correct: i === q!.correctIndex });
    }
    if (i === q!.correctIndex) setScore((s) => s + 1);
    getAudioEngine().playSfx(i === q!.correctIndex ? "chime" : "page");
  };

  return (
    <div className="rounded-md border border-lapis/25 bg-lapis/5 p-4">
      <p className="text-[11px] font-semibold tracking-wider text-lapis uppercase">
        {format(m.legacy.question, { n: qi + 1, total: questions.length })}
      </p>
      <AnimatePresence mode="wait">
        <motion.div key={qi} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
          <p className={`mt-1 font-medium text-ink ${teacher ? "text-xl" : ""}`}>{t(q!.question, locale)}</p>
          <ul className="mt-3 space-y-2">
            {q!.options.map((opt, i) => {
              const state =
                answer === null
                  ? classPick === i
                    ? "picked"
                    : "idle"
                  : i === q!.correctIndex
                    ? "correct"
                    : i === answer
                      ? "wrong"
                      : "other";
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={answer !== null}
                    aria-pressed={teacher ? classPick === i : undefined}
                    onClick={() => (teacher ? setClassPick(i) : reveal(i))}
                    className={`flex w-full items-start gap-2 rounded border px-3 py-2 text-left text-sm transition-colors ${
                      {
                        idle: "border-ink/20 bg-parchment-light hover:border-lapis",
                        picked: "border-lapis bg-lapis/10 text-ink",
                        correct: "border-turquoise bg-turquoise/10 text-ink",
                        wrong: "border-carmine bg-carmine/10 text-ink",
                        other: "border-ink/10 opacity-60",
                      }[state]
                    }`}
                  >
                    {teacher && <span className="font-display font-semibold text-lapis">{String.fromCharCode(65 + i)}</span>}
                    <span>{t(opt, locale)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {teacher && answer === null && (
            <button
              type="button"
              onClick={() => reveal(classPick ?? -1)}
              className="mt-3 rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-parchment-light hover:bg-ink-soft"
            >
              {m.legacy.teacherReveal}
            </button>
          )}
          {answer !== null && (
            <div className="mt-3" aria-live="polite">
              <p className={`font-semibold ${answer === q!.correctIndex ? "text-turquoise" : "text-carmine"}`}>
                {answer === q!.correctIndex ? m.legacy.correct : m.legacy.wrong}
              </p>
              <p className="mt-1 text-sm text-ink-soft">{t(q!.explanation, locale)}</p>
              <button
                type="button"
                onClick={() => {
                  const last = qi + 1 >= questions.length;
                  if (last) onFinish(score, questions.length);
                  setAnswer(null);
                  setClassPick(null);
                  setQi((n) => n + 1);
                }}
                className="mt-3 rounded-full bg-lapis px-4 py-1.5 text-sm font-medium text-parchment-light hover:bg-lapis-light"
              >
                {qi + 1 < questions.length ? m.legacy.nextQuestion : m.legacy.finish}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Soft reward: the person's card joins the collection when their life is finished. */
function EarnedCard({ journey, locale, m }: { journey: Journey; locale: Locale; m: Messages }) {
  const progress = useProgress();
  const { person } = journey;
  if (!progress.collection.cards[person.id]) return null;
  return (
    <div className="flex items-center gap-3 rounded-md border border-gold/60 bg-gradient-to-r from-gold/15 to-transparent p-3" role="status">
      {person.portrait && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={withBasePath(person.portrait.src)}
          alt=""
          className="h-14 w-11 shrink-0 rounded-sm border-2 border-gold object-cover object-top shadow"
        />
      )}
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-[#7a5a17] uppercase">{m.legacy.cardEarned}</p>
        <p className="text-sm text-ink">{format(m.legacy.cardEarnedText, { name: t(person.name, locale) })}</p>
      </div>
    </div>
  );
}
