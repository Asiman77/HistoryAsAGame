"use client";

import { motion, type Variants } from "motion/react";
import { useTranslations } from "next-intl";
import { ClaimBadge } from "@/components/claims/ClaimBadge";
import { Chip } from "@/components/ui/Chip";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { cx } from "@/lib/cx";
import type { ShellChoice, ShellStep } from "../types";
import { AlternativeVersions, BattleCard, hasMore, MoreSection } from "./StepExtras";
import type { ShellMode } from "./TopBar";

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

function ChoiceCard({ choice, picked, onPick }: { choice: ShellChoice; picked: number | undefined; onPick: (i: number) => void }) {
  const t = useTranslations("shell.choice");
  return (
    <div className="flex flex-col gap-3 rounded-panel border border-line-strong bg-surface/40 p-5" data-testid="choice-card">
      <Eyebrow>{t("title")}</Eyebrow>
      <p className="m-0 font-heading text-19 text-fg">{choice.prompt}</p>
      <div className="flex flex-col gap-2" role="group" aria-label={choice.prompt}>
        {choice.options.map((o, i) => {
          const isPicked = picked === i;
          const isHistorical = picked !== undefined && i === choice.historical;
          return (
            <button
              key={i}
              type="button"
              disabled={picked !== undefined}
              aria-pressed={isPicked}
              onClick={() => onPick(i)}
              className={cx(
                "flex min-h-11 flex-col gap-1 rounded-button border px-4 py-2.5 text-left text-14 transition-colors",
                picked === undefined && "border-fg/15 text-fg hover:border-line-strong hover:bg-fg/5",
                isHistorical && "border-claim-fact/60 bg-claim-fact/10 text-fg",
                picked !== undefined && !isHistorical && (isPicked ? "border-fg/30 text-fg" : "border-fg/10 text-fg-muted"),
              )}
            >
              <span className="font-medium">{o.text}</span>
              {picked !== undefined ? (
                <span className="text-13 text-fg-secondary">
                  {isHistorical ? `${t("historical")} · ` : isPicked ? `${t("yours")} · ` : ""}
                  {o.explanation}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {picked !== undefined ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3" data-testid="choice-result">
          <p className="m-0 text-14 font-semibold text-fg">{picked === choice.historical ? t("match") : t("differ")}</p>
          <p className="m-0 text-14 leading-relaxed text-fg-secondary">{choice.why}</p>
          <p className="m-0 text-12 italic text-fg-muted">{t("note")}</p>
        </div>
      ) : null}
    </div>
  );
}

export interface StepContentProps {
  step: ShellStep;
  total: number;
  /** Position among the visible steps (legends may be hidden). */
  position: number;
  mode: ShellMode;
  stagger: number;
  picked: number | undefined;
  onPick: (i: number) => void;
  /** Rəvayətlər toggle: legend statements fold away when off. */
  legends: boolean;
  /** Opens the city card of a catalogue place. */
  onPlace?: (placeId: string) => void;
  /** A related link is about to be followed (the shell remembers the way back). */
  onFollow?: (href: string) => void;
  compact?: boolean;
}

/**
 * The text of a step (§5.1, §5.6): header with the claim badge, title, then
 * the narrative first (story) or the facts and open sources first (learn).
 * Children come in one after another, `stagger` ms apart.
 */
export function StepContent({ step, total, position, mode, stagger, picked, onPick, legends, onPlace, onFollow, compact }: StepContentProps) {
  const t = useTranslations("shell");
  const disputed = step.claims.filter((c) => c.type === "disputed");
  const others = step.claims.filter((c) => c.type !== "disputed");
  return (
    <motion.article
      key={step.id}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger / 1000 } } }}
      className="flex flex-col gap-4"
      data-testid="step-content"
      data-step={step.id}
    >
      <motion.div variants={item} className="flex items-center justify-between gap-3">
        <Eyebrow as="p" className="text-12">
          {t("stepHeader", { current: position + 1, total })} · {step.kind}
        </Eyebrow>
        <ClaimBadge type={step.claimType} />
      </motion.div>
      <motion.h2 variants={item} className={cx("m-0 font-heading font-medium leading-[1.08] text-fg", compact ? "text-34" : "text-38 xl:text-44")}>
        {step.title}
      </motion.h2>
      <motion.p variants={item} className="m-0 text-13 text-fg-muted" data-testid="step-meta">
        {step.dateLabel} · {step.from ? `${step.from} → ` : ""}
        {step.placeId && onPlace ? (
          <button
            type="button"
            onClick={() => onPlace(step.placeId!)}
            className="text-fg-secondary underline decoration-dotted underline-offset-2 hover:text-fg"
            aria-label={t("place.open", { name: step.placeName })}
            data-testid="place-link"
          >
            {step.placeName}
          </button>
        ) : (
          step.placeName
        )}
        {step.distanceKm > 0 ? ` · ${t("distance", { km: step.distanceKm })}` : ""}
        {step.approximatePlace ? ` · ${t("approxPlace")}` : ""}
        {mode === "learn" && step.modernName ? ` · ${t("modern", { name: step.modernName })}` : ""}
      </motion.p>
      {mode === "story" && step.narrative ? (
        <motion.blockquote variants={item} className="m-0 font-heading text-19 italic leading-snug text-fg xl:text-22" data-testid="narrative">
          “{step.narrative}”
        </motion.blockquote>
      ) : null}
      <motion.p variants={item} className={cx("m-0 leading-relaxed text-fg-secondary", mode === "learn" ? "text-16 text-fg" : "text-15")} data-testid="summary">
        {step.summary}
      </motion.p>
      {step.battle ? (
        <motion.div variants={item}>
          <BattleCard battle={step.battle} />
        </motion.div>
      ) : null}
      {disputed.length ? (
        <motion.div variants={item}>
          <AlternativeVersions claims={disputed} />
        </motion.div>
      ) : null}
      {step.related.length ? (
        <motion.div variants={item} className="flex flex-wrap gap-2" aria-label={t("related")}>
          {step.related.map((r) => (
            <Chip key={r.label} href={r.href ?? undefined} {...(r.href && onFollow ? { onClick: () => onFollow(r.href!) } : {})}>
              {r.label}
            </Chip>
          ))}
        </motion.div>
      ) : null}
      {step.choice ? (
        <motion.div variants={item}>
          <ChoiceCard choice={step.choice} picked={picked} onPick={onPick} />
        </motion.div>
      ) : null}
      {step.sources.length ? (
        <motion.details variants={item} open={mode === "learn"} className="group rounded-panel border border-line px-4 py-3" data-testid="sources">
          <summary className="cursor-pointer text-14 font-semibold text-fg">{t("sources", { n: step.sources.length })}</summary>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0 text-13 text-fg-secondary">
            {step.sources.map((s) => (
              <li key={s.title}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
                    {s.title}
                  </a>
                ) : (
                  <span className="text-fg">{s.title}</span>
                )}
                {s.author ? ` · ${s.author}` : ""}
                {s.note ? <span className="block text-fg-muted">{s.note}</span> : null}
              </li>
            ))}
          </ul>
        </motion.details>
      ) : null}
      {hasMore(step.more, others) ? (
        <motion.div variants={item}>
          <MoreSection more={step.more} claims={others} year={step.year} legends={legends} open={mode === "learn"} />
        </motion.div>
      ) : null}
    </motion.article>
  );
}
