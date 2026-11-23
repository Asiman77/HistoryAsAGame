"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink, buttonClass } from "@/components/ui/Button";
import { cx } from "@/lib/cx";
import type { ShellStep } from "../types";

export interface StepNavProps {
  prev: ShellStep | null;
  next: ShellStep | null;
  /** After the last step. */
  final: { href: string; label: string } | null;
  onPrev: () => void;
  onNext: () => void;
  compact?: boolean;
}

const label = (s: ShellStep) => `${s.nodeLabel}, ${s.year}`;

/**
 * Previous / next with the neighbours' names (§5.1). Always enabled: a click
 * during a transition skips it (§5.3), it never waits.
 */
export function StepNav({ prev, next, final, onPrev, onNext, compact }: StepNavProps) {
  const t = useTranslations("shell");
  const nextButton = next ? (
    <Button size="lg" onClick={onNext} className="min-w-0 flex-1" aria-keyshortcuts="ArrowRight" data-testid="step-next">
      <span className="truncate">{compact ? t("nextLabel", { label: label(next) }) : label(next)}</span> <span aria-hidden>→</span>
    </Button>
  ) : final ? (
    <ButtonLink href={final.href} size="lg" className="min-w-0 flex-1" data-testid="step-final">
      <span className="truncate">{final.label}</span> <span aria-hidden>→</span>
    </ButtonLink>
  ) : (
    <span className="flex-1" />
  );

  if (compact) {
    return (
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={!prev}
          aria-label={prev ? `${t("prev")}: ${label(prev)}` : t("prev")}
          className={cx(buttonClass({ variant: "secondary", size: "lg" }), "w-14 shrink-0 px-0")}
          data-testid="step-prev"
        >
          <ArrowLeft size={18} aria-hidden />
        </button>
        {nextButton}
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Button
        variant="secondary"
        size="lg"
        onClick={onPrev}
        disabled={!prev}
        className="min-w-0 max-w-[45%] shrink"
        aria-label={prev ? `${t("prev")}: ${label(prev)}` : t("prev")}
        aria-keyshortcuts="ArrowLeft"
        data-testid="step-prev"
      >
        <span aria-hidden>←</span> <span className="truncate">{prev ? prev.nodeLabel : ""}</span>
      </Button>
      {nextButton}
    </div>
  );
}
