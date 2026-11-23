"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import type { ShellStep } from "../types";

/**
 * Portrait for the person's age with the age and year counters (§5.1).
 * The portrait crossfades (500 ms) when it changes; the counters roll.
 * An AI illustration always carries its caption (spec 2 rule).
 */
export function PortraitCard({ step, crossfadeMs }: { step: ShellStep; crossfadeMs: number }) {
  const t = useTranslations("shell");
  const portrait = step.portrait;
  return (
    <div className="w-[236px] overflow-hidden rounded-card border border-line bg-surface-panel shadow-deep" data-testid="portrait-card">
      <div className="relative h-[200px] overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--secondary) 70%, transparent), var(--bg-panel))" }}>
        <AnimatePresence initial={false}>
          {portrait?.src ? (
            <motion.img
              key={portrait.src}
              src={portrait.src}
              alt={portrait.alt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: crossfadeMs / 1000 }}
              className="absolute inset-0 size-full object-cover object-top"
            />
          ) : null}
        </AnimatePresence>
        {portrait?.ai ? (
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-surface/80 px-2.5 py-1 text-12 text-fg backdrop-blur-sm">{t("aiPortrait")}</span>
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
    </div>
  );
}
