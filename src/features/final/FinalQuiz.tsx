"use client";

import { ArrowDown, ArrowUp, Check, Scale, Star } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getAudioEngine } from "@/features/audio/engine";
import { project } from "@/features/simulation-shell/map/projection";
import { Link } from "@/i18n/navigation";
import { ownerOf, track } from "@/lib/analytics/client";
import { cx } from "@/lib/cx";
import {
  CLAIM_ANSWERS,
  grade,
  scoreOf,
  type ChoiceQuestion,
  type ClaimAnswer,
  type ClaimQuestion,
  type MapQuestion,
  type OrderQuestion,
  type QuizAnswer,
  type QuizQuestion,
} from "./quiz";

const CLAIM_ICON = { fact: Check, disputed: Scale, legend: Star } as const;
const CLAIM_TONE: Record<ClaimAnswer, string> = {
  fact: "border-claim-fact text-claim-fact bg-claim-fact/15",
  disputed: "border-claim-disputed text-claim-disputed bg-claim-disputed/15",
  legend: "border-claim-legend text-claim-legend bg-claim-legend/15",
};
const LETTERS = "ABCDEFGH";

type Answered = { answer: QuizAnswer; right: boolean };

interface QuestionProps<Q extends QuizQuestion> {
  q: Q;
  answered: Answered | null;
  onAnswer: (a: QuizAnswer) => void;
}

function optionClass(state: "idle" | "right" | "wrong" | "other") {
  return cx(
    "flex min-h-14 w-full items-center gap-3 rounded-button-lg border px-4 py-3 text-left text-15 transition-colors",
    state === "idle" && "border-fg/25 text-fg hover:border-line-strong hover:bg-fg/5",
    state === "right" && "border-2 border-claim-fact bg-claim-fact/15 font-semibold text-fg",
    state === "wrong" && "border-2 border-negative bg-negative/10 text-fg",
    state === "other" && "border-fg/10 text-fg-muted",
  );
}

function ChoiceView({ q, answered, onAnswer }: QuestionProps<ChoiceQuestion>) {
  return (
    <>
      <p className="m-0 font-heading text-22 leading-snug text-fg">{q.question}</p>
      <div className="flex flex-col gap-2.5" role="group" aria-label={q.question}>
        {q.options.map((o, i) => {
          const state = !answered ? "idle" : i === q.correct ? "right" : i === answered.answer ? "wrong" : "other";
          return (
            <button key={i} type="button" disabled={!!answered} onClick={() => onAnswer(i)} aria-pressed={answered?.answer === i} className={optionClass(state)}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-current text-13 font-semibold">{LETTERS[i]}</span>
              <span>{o}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ClaimView({ q, answered, onAnswer }: QuestionProps<ClaimQuestion>) {
  const t = useTranslations("ui.claim");
  return (
    <>
      <p className="m-0 font-heading text-22 leading-snug text-fg" data-testid="claim-statement">
        “{q.statement}”
      </p>
      <div className="grid grid-cols-3 gap-2.5" role="group" aria-label={q.statement}>
        {CLAIM_ANSWERS.map((a) => {
          const Icon = CLAIM_ICON[a];
          const state = !answered ? "idle" : a === q.correct ? "right" : a === answered.answer ? "wrong" : "other";
          return (
            <button
              key={a}
              type="button"
              disabled={!!answered}
              onClick={() => onAnswer(a)}
              aria-pressed={answered?.answer === a}
              className={cx(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-button-lg border px-2 text-14 font-semibold transition-colors",
                state === "idle" && "border-fg/25 text-fg hover:bg-fg/5",
                state === "right" && cx("border-2", CLAIM_TONE[a]),
                state === "wrong" && "border-2 border-negative bg-negative/10 text-fg",
                state === "other" && "border-fg/10 text-fg-muted",
              )}
            >
              <Icon size={16} aria-hidden fill={a === "legend" ? "currentColor" : "none"} />
              {t(a)}
            </button>
          );
        })}
      </div>
    </>
  );
}

function OrderView({ q, answered, onAnswer }: QuestionProps<OrderQuestion>) {
  const t = useTranslations("final.quiz");
  const [order, setOrder] = useState(() => q.events.map((e) => e.id));
  const byId = (id: string) => q.events.find((e) => e.id === id)!;
  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const next = [...o];
      [next[i], next[i + d]] = [next[i + d]!, next[i]!];
      return next;
    });
  const shown = answered ? (answered.answer as string[]) : order;
  return (
    <>
      <p className="m-0 font-heading text-22 leading-snug text-fg">{t("orderLead")}</p>
      <ol className="m-0 flex list-none flex-col gap-2 p-0" data-testid="order-list">
        {shown.map((id, i) => {
          const e = byId(id);
          const right = answered ? q.correct[i] === id : null;
          return (
            <li
              key={id}
              className={cx(
                "flex min-h-14 items-center gap-3 rounded-button-lg border px-3 py-2 text-15",
                right === null && "border-fg/25 text-fg",
                right === true && "border-claim-fact bg-claim-fact/10 text-fg",
                right === false && "border-negative bg-negative/10 text-fg",
              )}
              data-id={id}
            >
              <span className="w-5 shrink-0 text-center font-heading text-19 text-fg-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                {e.title}
                {answered ? <span className="ml-2 text-13 text-fg-muted">{e.yearLabel}</span> : null}
              </span>
              {!answered ? (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={t("up", { title: e.title })}
                    className="inline-flex size-10 items-center justify-center rounded-full text-fg-secondary hover:bg-fg/10 disabled:opacity-30"
                  >
                    <ArrowUp size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={i === shown.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={t("down", { title: e.title })}
                    className="inline-flex size-10 items-center justify-center rounded-full text-fg-secondary hover:bg-fg/10 disabled:opacity-30"
                  >
                    <ArrowDown size={16} aria-hidden />
                  </button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {!answered ? (
        <Button variant="outline" onClick={() => onAnswer(order)} className="self-start" data-testid="order-check">
          {t("check")}
        </Button>
      ) : null}
    </>
  );
}

function MapView({ q, answered, onAnswer, land }: QuestionProps<MapQuestion> & { land: string }) {
  const t = useTranslations("final.quiz");
  const pts = q.options.map((o) => ({ ...o, xy: project(o.center) }));
  const xs = pts.map((p) => p.xy[0]);
  const ys = pts.map((p) => p.xy[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * 2, 4);
  const w = span * 1.6;
  const h = w / 2;
  const x0 = (Math.min(...xs) + Math.max(...xs)) / 2 - w / 2;
  const y0 = (Math.min(...ys) + Math.max(...ys)) / 2 - h / 2;
  return (
    <>
      <p className="m-0 font-heading text-22 leading-snug text-fg">{t("mapLead", { place: q.place })}</p>
      <p className="m-0 text-13 text-fg-muted">{q.context}</p>
      <div className="relative overflow-hidden rounded-panel border border-line" style={{ aspectRatio: "2", background: "var(--map-parchment-center)" }} data-testid="map-quiz">
        <svg viewBox={`${x0} ${y0} ${w} ${h}`} className="absolute inset-0 size-full text-map-ink" aria-hidden>
          <rect x={x0} y={y0} width={w} height={h} fill="var(--map-water)" fillOpacity={0.55} />
          <path d={land} fill="var(--map-parchment-center)" stroke="currentColor" strokeOpacity={0.45} strokeWidth={w / 400} fillRule="evenodd" />
        </svg>
        {pts.map((p, i) => {
          const left = ((p.xy[0] - x0) / w) * 100;
          const top = ((p.xy[1] - y0) / h) * 100;
          const state = !answered ? "idle" : p.id === q.correct ? "right" : p.id === answered.answer ? "wrong" : "other";
          return (
            <span key={p.id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{ left: `${left}%`, top: `${top}%` }}>
              <button
                type="button"
                disabled={!!answered}
                onClick={() => onAnswer(p.id)}
                aria-label={answered ? t("pointAnswered", { letter: LETTERS[i]!, name: p.name }) : t("point", { letter: LETTERS[i]! })}
                aria-pressed={answered?.answer === p.id}
                className={cx(
                  "grid size-11 place-items-center rounded-full border-2 font-heading text-19 font-semibold shadow-deep transition-transform",
                  state === "idle" && "border-map-ink bg-map-parchment-mid text-map-ink hover:scale-110",
                  state === "right" && "border-claim-fact bg-claim-fact text-surface",
                  state === "wrong" && "border-negative bg-negative text-surface",
                  state === "other" && "border-map-ink/40 bg-map-parchment-mid/60 text-map-ink/60",
                )}
              >
                {LETTERS[i]}
              </button>
              {answered ? <span className="whitespace-nowrap rounded-full bg-map-parchment-center/90 px-2 text-12 text-map-ink">{p.name}</span> : null}
            </span>
          );
        })}
      </div>
    </>
  );
}

export interface FinalQuizProps {
  /** Owner of the quiz's learning events ("person:shah-ismayil"); null when each question names its own (a curriculum topic). */
  ownerKey: string | null;
  deck: QuizQuestion[];
  land: string;
  simHref: string;
  /** A perfect score earns the quiz badge (saved progress). */
  onFinish: (score: number, total: number) => void;
  /** Whose quiz it is, for the result's words: a life (person) or a curriculum topic. */
  about?: "life" | "topic";
}

/**
 * The final quiz (§6.9): four kinds of question from the journey's own data.
 * After every answer an explanation and a link back to the step it comes
 * from; at the end the score, a badge for a perfect round and a new round.
 */
export function FinalQuiz({ ownerKey, deck, land, simHref, onFinish, about = "life" }: FinalQuizProps) {
  const t = useTranslations("final.quiz");
  const claimT = useTranslations("ui.claim");
  const help = useTranslations("claims.help");
  const reduced = useReducedMotion();
  const owner = useMemo(() => (ownerKey ? ownerOf(ownerKey) : null), [ownerKey]);
  const [round, setRound] = useState(0);
  const [qi, setQi] = useState(0);
  const [results, setResults] = useState<(Answered | null)[]>(() => deck.map(() => null));
  const q = deck[qi];
  const answered = results[qi] ?? null;
  const done = qi >= deck.length;

  if (!deck.length) return <p className="m-0 text-15 text-fg-secondary">{t("empty")}</p>;

  const answer = (a: QuizAnswer) => {
    if (!q || answered) return;
    const right = grade(q, a);
    setResults((r) => r.map((x, i) => (i === qi ? { answer: a, right } : x)));
    const by = q.kind === "choice" ? (q.owner ? ownerOf(q.owner) : owner) : null;
    if (q.kind === "choice" && by) track({ type: "quiz_answered", ...by, stepKey: q.stepKey, questionIndex: q.questionIndex, correct: right });
    getAudioEngine().playSfx(right ? "chime" : "page");
  };
  const next = () => {
    if (qi + 1 >= deck.length) {
      const s = scoreOf(results.map((r) => !!r?.right));
      onFinish(s.score, s.total);
    }
    setQi((i) => i + 1);
  };
  const restart = () => {
    setRound((r) => r + 1);
    setQi(0);
    setResults(deck.map(() => null));
  };

  const segments = (
    <div aria-hidden className="mt-auto flex gap-1.5 pt-2">
      {deck.map((_, i) => (
        <span
          key={i}
          className={cx(
            "h-1.5 flex-1 rounded-full",
            results[i] ? (results[i]!.right ? "bg-claim-fact" : "bg-negative") : i === qi ? "bg-accent" : "bg-fg/15",
          )}
        />
      ))}
    </div>
  );

  if (done || !q) {
    const s = scoreOf(results.map((r) => !!r?.right));
    return (
      <div className="flex flex-1 flex-col gap-4" role="status" data-testid="quiz-result">
        <Eyebrow as="p">{t("resultTitle")}</Eyebrow>
        <p className="m-0 font-heading text-60 font-medium leading-none text-fg" data-testid="quiz-score">
          {t("score", { score: s.score, total: s.total })}
        </p>
        <p className="m-0 text-16 text-fg-secondary">{about === "topic" ? t(`topic.${s.level}`) : t(s.level)}</p>
        {s.perfect ? (
          <p className="m-0 inline-flex items-center gap-2 self-start rounded-full border border-accent bg-accent/15 px-3 py-1.5 text-14 font-semibold text-accent" data-testid="quiz-badge">
            <Star size={14} aria-hidden fill="currentColor" /> {t("badge")}
          </p>
        ) : null}
        <Button variant="secondary" onClick={restart} className="self-start" data-testid="quiz-again">
          {t("again")}
        </Button>
        {segments}
      </div>
    );
  }

  const feedback = answered ? (
    <div
      className={cx("flex flex-col gap-1.5 rounded-button-lg px-4 py-3.5 text-14 leading-relaxed", answered.right ? "bg-claim-fact/12 text-fg" : "bg-negative/12 text-fg")}
      aria-live="polite"
      data-testid="quiz-feedback"
      data-right={answered.right}
    >
      <p className="m-0 font-semibold">
        {answered.right ? t("correct") : t("wrong")}
        {!answered.right && q.kind === "claim" ? ` ${t("claimWrong", { type: claimT(q.correct) })}` : ""}
      </p>
      {q.kind === "choice" ? <p className="m-0 text-fg-secondary">{q.explanation}</p> : null}
      {q.kind === "claim" ? <p className="m-0 text-fg-secondary">{q.explanation ?? help(q.correct)}</p> : null}
      {q.kind === "order" && !answered.right ? (
        <p className="m-0 text-fg-secondary">
          {t("orderWrong")} {q.correct.map((id) => q.events.find((e) => e.id === id)!).map((e) => `${e.title} (${e.yearLabel})`).join(" → ")}
        </p>
      ) : null}
      {q.step ? (
        <Link href={`${simHref}?step=${q.step.id}`} className="self-start text-14 font-semibold text-accent underline-offset-2 hover:underline" data-testid="quiz-step-link">
          {t("seeStep", { n: q.step.number, title: q.step.title })} →
        </Link>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="flex flex-1 flex-col gap-4" data-testid="final-quiz" data-kind={q.kind} data-question={q.id}>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow as="p">{t("label", { n: qi + 1, total: deck.length })}</Eyebrow>
        <span className="text-13 text-fg-muted">{t(`kinds.${q.kind}`)}</span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${round}-${qi}`}
          initial={reduced ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -12 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-4"
        >
          {q.kind === "choice" ? <ChoiceView q={q} answered={answered} onAnswer={answer} /> : null}
          {q.kind === "claim" ? <ClaimView q={q} answered={answered} onAnswer={answer} /> : null}
          {q.kind === "order" ? <OrderView q={q} answered={answered} onAnswer={answer} /> : null}
          {q.kind === "map" ? <MapView q={q} answered={answered} onAnswer={answer} land={land} /> : null}
          {feedback}
          {answered ? (
            <Button onClick={next} className="self-end" data-testid="quiz-next">
              {qi + 1 < deck.length ? t("next") : t("finish")} <span aria-hidden>→</span>
            </Button>
          ) : null}
        </motion.div>
      </AnimatePresence>
      {segments}
    </div>
  );
}
