"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ProgressBar, ProgressRing } from "@/components/ui/Progress";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { useProgress } from "@/lib/progress";
import { ClassCode } from "./ClassCode";
import type { GradeData, SectionData, TopicCardData } from "./data";
import { firstOpenSection, sectionShare, topicRow, type TopicRowState } from "./status";

/**
 * A grade of "Dərsliklə öyrən" (Curriculum artboard, FRONTEND_SPEC §6.3):
 * sections with their progress rings on the left, the topics of the chosen
 * section on the right with their status (tamamlandı / davam edir / yeni /
 * hazırlanır). Topics "hazırlanır" are listed but cannot be opened.
 */
export function GradeScreen({ data }: { data: GradeData }) {
  const t = useTranslations("pages.curriculum");
  const { persons: progress, quizzes } = useProgress();
  const [picked, setPicked] = useState<string | null>(null);
  // Until the student picks one: the first section with work left (progress is read after hydration).
  const shownId = picked ?? firstOpenSection(data.sections, progress);
  const section = data.sections.find((s) => s.id === shownId) ?? data.sections[0];

  return (
    <div className="flex flex-col gap-7" data-testid="grade-screen">
      {data.sample ? (
        <p className="m-0 rounded-button border border-dashed border-accent/35 bg-accent/8 px-4 py-3 text-14 text-fg-secondary" data-testid="sample-notice">
          {t("sampleNotice")}
        </p>
      ) : null}
      {data.textbook ? (
        <p className="m-0 text-14 text-fg-muted">
          {data.textbook.url ? (
            <a href={data.textbook.url} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
              {t("textbook", { title: data.textbook.title, authors: data.textbook.authors, year: data.textbook.year })}
            </a>
          ) : (
            t("textbook", { title: data.textbook.title, authors: data.textbook.authors, year: data.textbook.year })
          )}
        </p>
      ) : null}

      {/* Phones: sections, topics, class code. From lg the class code sits under the sections (artboard columns). */}
      <div className="grid items-start gap-7 lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
        <nav aria-label={t("sections")} className="flex flex-col gap-2.5 lg:col-start-1 lg:row-start-1" data-testid="section-nav">
          {data.sections.map((s) => (
            <SectionButton key={s.id} section={s} share={sectionShare(s, progress)} active={s.id === section?.id} onPick={() => setPicked(s.id)} />
          ))}
        </nav>

        {section ? (
          <section
            aria-label={t("topics", { section: t("section", { n: section.number }) })}
            className="flex min-w-0 flex-col gap-3.5 lg:col-start-2 lg:row-span-2 lg:row-start-1"
            id="topics"
          >
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0" data-testid="topic-list">
              {section.topics.map((topic) => (
                <TopicRow key={topic.id} topic={topic} state={topicRow(topic, progress, quizzes)} />
              ))}
            </ol>
          </section>
        ) : null}

        <div className="flex flex-col lg:col-start-1 lg:row-start-2">
          <ClassCode />
        </div>
      </div>
    </div>
  );
}

function SectionButton({ section, share, active, onPick }: { section: SectionData; share: number; active: boolean; onPick: () => void }) {
  const t = useTranslations("pages.curriculum");
  return (
    <button
      type="button"
      onClick={onPick}
      aria-current={active ? "true" : undefined}
      aria-controls="topics"
      className={cx(
        "flex items-center gap-3.5 rounded-card border p-4 text-left transition-colors",
        active ? "border-secondary bg-secondary/25 text-fg" : "border-fg/12 text-fg-secondary hover:border-fg/25 hover:bg-fg/5",
      )}
      data-testid="section-button"
      data-section={section.id}
    >
      <ProgressRing value={share} size={44} stroke={4} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cx("text-12", active ? "text-fg-secondary" : "text-fg-muted")}>{t("section", { n: section.number })}</span>
        <span className="font-semibold">{section.title}</span>
      </span>
    </button>
  );
}

function TopicRow({ topic, state }: { topic: TopicCardData; state: TopicRowState }) {
  const t = useTranslations("pages.curriculum");
  const { status, share, quiz } = state;
  const meta = [
    topic.paragraph,
    status === "preparing" ? t("preparing") : t("steps", { n: topic.steps }),
    status !== "preparing" && topic.minutes ? t("minutes", { n: topic.minutes }) : null,
    status === "done" && quiz ? t("quiz", { score: quiz.score, total: quiz.total }) : null,
    status === "new" && topic.owners.length ? t("with", { count: topic.owners.length, names: topic.owners.join(", ") }) : null,
  ].filter(Boolean);

  return (
    <li
      className={cx(
        "grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-card border bg-surface-raised px-4.5 py-4 sm:grid-cols-[52px_minmax(0,1fr)_auto]",
        status === "progress" ? "border-accent/45" : "border-fg/8",
      )}
      data-testid="topic-row"
      data-topic={topic.id}
      data-status={status}
    >
      <span
        className={cx(
          "flex size-11 items-center justify-center rounded-button font-bold",
          status === "done" && "bg-claim-fact/20 text-claim-fact",
          status === "progress" && "bg-accent/18 text-accent",
          (status === "new" || status === "preparing") && "bg-fg/6 text-fg-muted",
        )}
        role="img"
        aria-label={t(`status.${status}`)}
      >
        {status === "done" ? <Check size={20} strokeWidth={2.5} aria-hidden /> : <span aria-hidden>{topic.number}</span>}
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="text-16 font-semibold text-fg">{topic.title}</span>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-13 text-fg-muted" data-testid="topic-meta">
          {meta.join(" · ")}
          {status === "progress" ? <ProgressBar value={share} className="w-30 h-1.5" /> : null}
        </span>
      </span>
      {status === "preparing" ? (
        <span className="col-start-2 text-13 text-fg-muted sm:col-start-auto">{t("action.preparing")}</span>
      ) : (
        <Link
          href={topic.href}
          aria-label={`${t(`action.${status}`)}: ${topic.title}`}
          className={cx("col-start-2 justify-self-start text-14 text-accent hover:underline sm:col-start-auto", status === "progress" && "font-semibold")}
          data-testid="topic-action"
        >
          {t(`action.${status}`)}
          {status === "progress" ? <span aria-hidden> →</span> : null}
        </Link>
      )}
    </li>
  );
}
