"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@/domain/schema";
import { CLAIM_STYLE, pickRound, type ClassifyItem } from "@/lib/claims";
import { format, t, type Messages } from "@/lib/i18n";
import { ClaimIcon } from "./ClaimBadge";

const ANSWERS = ["fact", "disputed", "legend"] as const;

/**
 * "Fakt yoxsa rəvayət?": the student classifies statements taken from the
 * simulation's own claims, then sees why. Literary text never appears here.
 */
export function FactOrLegendQuiz({ items, locale, m, size = 6 }: { items: ClassifyItem[]; locale: Locale; m: Messages; size?: number }) {
  const [round, setRound] = useState(1);
  const deck = useMemo(() => pickRound(items, size, round), [items, size, round]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<(typeof ANSWERS)[number] | null>(null);
  const [score, setScore] = useState(0);
  if (deck.length < 2) return null;

  const item = deck[i];
  const done = i >= deck.length;
  const choose = (a: (typeof ANSWERS)[number]) => {
    if (picked || !item) return;
    setPicked(a);
    if (a === item.answer) setScore((s) => s + 1);
  };

  return (
    <section className="rounded-lg border border-ink/10 bg-parchment/60 p-4" data-testid="fact-or-legend" aria-label={m.claims.quiz.title}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-semibold text-ink">{m.claims.quiz.title}</h3>
        {!done && <span className="text-xs text-ink-faint tabular-nums">{format(m.claims.quiz.of, { n: i + 1, total: deck.length })}</span>}
      </div>
      {done || !item ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="font-semibold text-ink" data-testid="fol-score">{format(m.claims.quiz.score, { n: score, total: deck.length })}</p>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setRound((r) => r + 1);
              setI(0);
              setScore(0);
              setPicked(null);
            }}
          >
            {m.claims.quiz.again}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-xs text-ink-soft">{m.claims.quiz.lead}</p>
          <blockquote className="mt-3 border-l-4 border-gold/60 pl-3 font-serif text-[1.02rem] leading-relaxed text-ink" data-testid="fol-statement">
            «{t(item.statement, locale)}»
          </blockquote>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={m.claims.quiz.title}>
            {ANSWERS.map((a) => {
              const c = CLAIM_STYLE[a];
              const state = !picked ? "idle" : a === item.answer ? "right" : a === picked ? "wrong" : "other";
              return (
                <button
                  key={a}
                  type="button"
                  disabled={!!picked}
                  onClick={() => choose(a)}
                  aria-pressed={picked === a}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-opacity ${state === "other" ? "opacity-40" : ""} ${state === "right" ? "ring-2 ring-offset-1" : ""}`}
                  style={{ color: c.fg, background: c.bg, borderColor: c.border, ...(state === "right" ? { ["--tw-ring-color" as string]: c.fg } : {}) }}
                >
                  <ClaimIcon type={a} size={14} />
                  {m.claims.types[a]}
                </button>
              );
            })}
          </div>
          {picked && (
            <div className="mt-3 rounded-md bg-parchment-light p-3 text-sm" aria-live="polite" data-testid="fol-feedback">
              <p className="font-semibold" style={{ color: CLAIM_STYLE[item.answer].fg }}>
                {picked === item.answer ? m.claims.quiz.correct : format(m.claims.quiz.wrong, { type: m.claims.types[item.answer] })}
              </p>
              <p className="mt-1 text-ink-soft">{item.explanation ? t(item.explanation, locale) : m.claims.help[item.answer]}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {t(item.stepTitle, locale)}
                {item.source && <> · {item.source.title}</>}
              </p>
              <button
                type="button"
                className="btn-primary mt-3 text-sm"
                onClick={() => {
                  setPicked(null);
                  setI((x) => x + 1);
                }}
              >
                {m.claims.quiz.next} →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
