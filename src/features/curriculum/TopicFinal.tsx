"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { PeriodTheme } from "@/components/layout/PeriodTheme";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Panel } from "@/components/ui/Panel";
import type { QuizQuestion } from "@/features/final/quiz";
import { FinalQuiz } from "@/features/final/FinalQuiz";
import { Link } from "@/i18n/navigation";
import { progressStore, recordQuiz, saveProgress, useProgress } from "@/lib/progress";
import type { StepOwner } from "./data";

export interface TopicFinalData {
  /** Progress key, "topic:<slug>". */
  key: string;
  title: string;
  /** "8-ci sinif · § 2" */
  eyebrow: string;
  summary: string | null;
  simHref: string;
  gradeHref: string;
  themeId: string;
  deck: QuizQuestion[];
  /** Projected land outline for the map question. */
  land: string;
  stepCount: number;
  lastIndex: number;
  owners: StepOwner[];
  next: { id: string; title: string; paragraph: string | null; href: string } | null;
}

/**
 * End of a curriculum topic (FRONTEND_SPEC §6.4): the quiz built from the
 * topic's steps, the simulations they come from, and "Növbəti mövzu".
 * Reaching it from the last step completes the topic in the grade list.
 */
export function TopicFinal({ data }: { data: TopicFinalData }) {
  const t = useTranslations("pages.topicFinal");
  const progress = useProgress().persons[data.key];

  // Completion only when the topic was followed to its end, never by opening the URL alone.
  useEffect(() => {
    const saved = progressStore.get().persons[data.key];
    if (!saved || saved.furthest < data.lastIndex) return;
    saveProgress(data.key, { index: data.stepCount - 1, phase: "legacy", choices: saved.choices }, data.stepCount);
  }, [data.key, data.lastIndex, data.stepCount]);

  return (
    <main
      className="relative isolate min-h-dvh"
      style={{ background: "radial-gradient(ellipse 50% 60% at 30% 40%, color-mix(in srgb, var(--secondary) 40%, transparent), transparent 70%), var(--bg-base)" }}
      data-testid="topic-final"
      data-completed={progress?.completed ? "true" : "false"}
    >
      <PeriodTheme id={data.themeId} />
      <div className="mx-auto grid max-w-[1280px] gap-8 px-4 pb-12 pt-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-12 lg:px-12 lg:pt-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <Link href={data.simHref} className="mb-2 inline-flex min-h-11 items-center gap-2 self-start text-14 text-fg-secondary hover:text-accent" data-testid="topic-final-back">
              <ArrowLeft aria-hidden size={18} /> {t("back")}
            </Link>
            <Eyebrow as="p" className="text-13 tracking-[0.22em]">
              {t("eyebrow", { grade: data.eyebrow })}
            </Eyebrow>
            <h1 className="m-0 font-heading text-44 font-medium leading-[1.05] text-fg lg:text-60">{data.title}</h1>
            {data.summary ? <p className="m-0 max-w-[560px] text-16 leading-relaxed text-fg-secondary">{data.summary}</p> : null}
          </div>

          <Panel className="flex flex-col gap-3 px-6 py-5" data-testid="topic-next">
            <Eyebrow as="p">{t("next")}</Eyebrow>
            {data.next ? (
              <>
                <p className="m-0 font-heading text-26 text-fg">{data.next.title}</p>
                {data.next.paragraph ? <p className="m-0 text-14 text-fg-muted">{data.next.paragraph}</p> : null}
                <ButtonLink href={data.next.href} size="lg" className="self-start" data-testid="topic-next-link">
                  {t("next")} <span aria-hidden>→</span>
                </ButtonLink>
              </>
            ) : (
              <p className="m-0 text-14 text-fg-secondary">{t("nextNone")}</p>
            )}
            <Link href={data.gradeHref} className="self-start text-14 font-semibold text-accent underline-offset-2 hover:underline">
              {t("grade")} →
            </Link>
          </Panel>

          {data.owners.length ? (
            <section className="flex flex-col gap-3" aria-labelledby="topic-sims">
              <h2 id="topic-sims" className="m-0 text-16 font-semibold text-fg">
                {t("sims")}
              </h2>
              <p className="m-0 text-14 text-fg-muted">{t("simsLead")}</p>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {data.owners.map((o) => (
                  <li key={`${o.type}:${o.id}`}>
                    <Link href={o.href} className="inline-flex min-h-11 items-center gap-1.5 rounded-button border border-line-strong px-4 text-14 font-medium text-fg hover:bg-accent/10">
                      {o.name} <span aria-hidden>→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <Panel className="flex min-h-[460px] flex-col p-6 lg:p-7" aria-label={t("quizTitle")}>
          <FinalQuiz about="topic" ownerKey={null} deck={data.deck} land={data.land} simHref={data.simHref} onFinish={(score, total) => recordQuiz(data.key, score, total)} />
        </Panel>
      </div>
    </main>
  );
}
