"use client";

import { Info } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import type { ShellPortrait, ShellStep } from "../types";

/** Respectful stand-in until a portrait file exists: a silhouette in an ornamental frame. */
export function Silhouette({ className }: { className?: string }) {
  const corners = [
    [6, 6],
    [114, 6],
    [6, 94],
    [114, 94],
  ] as const;
  return (
    <svg viewBox="0 0 120 100" preserveAspectRatio="xMidYMid meet" className={className} aria-hidden>
      <rect x="6" y="6" width="108" height="88" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.8" />
      {corners.map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - 3.5}L${x + 3.5} ${y}L${x} ${y + 3.5}L${x - 3.5} ${y}Z`} fill="currentColor" fillOpacity="0.35" />
      ))}
      <g fill="currentColor" fillOpacity="0.22">
        <ellipse cx="60" cy="40" rx="12" ry="14" />
        <path d="M60 57c-15 0-24 9-26.5 24-.6 4 .8 7 .8 7h51.4s1.4-3 .8-7C84 66 75 57 60 57z" />
      </g>
    </svg>
  );
}

/** Kind of the shown portrait, as the chip over the image says it. */
function useKindLabel() {
  const t = useTranslations("shell.portrait");
  return (p: ShellPortrait) => (p.src ? (p.kind ? t(p.kind) : null) : p.kind === "ai_illustration" ? t("pendingAi") : t("pending"));
}

/**
 * Portrait for the person's age with the age and year counters (§5.1).
 * The portrait crossfades (500 ms) when the age range changes; the counters
 * roll. What kind of image it is always shows (a work of the time, a later
 * artwork or an AI illustration); author, licence and source open from the
 * info button. Without a file: a silhouette and "being prepared".
 */
export function PortraitCard({ step, crossfadeMs }: { step: ShellStep; crossfadeMs: number }) {
  const t = useTranslations("shell");
  const kindLabel = useKindLabel();
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const portrait = step.portrait;
  const label = portrait ? kindLabel(portrait) : null;
  const hasDetails = !!portrait && (!!portrait.credit.author || !!portrait.credit.license || !!portrait.caption || !!portrait.ages);
  return (
    <figure
      className="m-0 w-[236px] overflow-hidden rounded-card border border-line bg-surface-panel shadow-deep"
      data-testid="portrait-card"
      data-portrait={portrait?.key ?? "none"}
      data-kind={portrait ? (portrait.src ? (portrait.kind ?? "single") : "pending") : "none"}
    >
      <div
        className="relative h-[200px] overflow-hidden text-fg"
        style={{ background: "radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--secondary) 70%, transparent), var(--bg-panel))" }}
      >
        <AnimatePresence initial={false}>
          {portrait ? (
            <motion.div
              key={portrait.key}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: crossfadeMs / 1000 }}
            >
              {portrait.src ? (
                // eslint-disable-next-line @next/next/no-img-element -- static export, no image optimizer
                <img src={portrait.src} alt={portrait.alt} className="size-full object-cover object-top" />
              ) : (
                <>
                  <Silhouette className="absolute inset-0 size-full p-3" />
                  <span className="sr-only">{portrait.alt}</span>
                </>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
        {label ? (
          <span
            className="absolute bottom-2.5 left-2.5 right-2.5 w-fit rounded-full bg-surface/85 px-2.5 py-1 text-12 leading-snug text-fg backdrop-blur-sm"
            data-testid="portrait-kind"
          >
            {label}
          </span>
        ) : null}
        {hasDetails ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={detailsId}
            aria-label={t("portrait.about")}
            className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-surface/80 text-fg backdrop-blur-sm hover:bg-surface"
            data-testid="portrait-info"
          >
            <Info size={16} aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3 px-5 py-3">
        {step.age ? (
          <span className="flex items-baseline gap-1.5 text-fg">
            <span className="font-heading text-48 font-medium leading-none" data-testid="age-value">
              {step.age.approximate ? "~" : ""}
              <AnimatedNumber value={step.age.years} />
            </span>
            <span className="text-14 text-fg-secondary">{t("age")}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="font-heading text-30 font-medium leading-none text-fg" data-testid="year-value">
          <AnimatedNumber value={step.year} />
        </span>
      </div>
      {open && portrait ? (
        <figcaption id={detailsId} className="flex flex-col gap-1 border-t border-line px-5 py-3 text-12 leading-snug text-fg-secondary" data-testid="portrait-details">
          <span className="text-fg">
            {portrait.ages ? t("portrait.ages", { from: portrait.ages.from, to: portrait.ages.to }) : null}
            {portrait.ages && label ? " · " : null}
            {label}
          </span>
          {portrait.caption ? <span>{portrait.caption}</span> : null}
          {portrait.credit.author ? <span>{portrait.credit.author}</span> : null}
          {portrait.credit.license ? <span>{t("portrait.license", { license: portrait.credit.license })}</span> : null}
          {portrait.credit.url ? (
            <a href={portrait.credit.url} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
              {t("portrait.source")}
            </a>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
