"use client";

import { Check, Feather, Scale, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type { ClaimType } from "@/domain/schema";
import { cx } from "@/lib/cx";

const STYLE: Record<ClaimType, { icon: typeof Check; className: string }> = {
  fact: { icon: Check, className: "border-claim-fact/45 bg-claim-fact/12 text-claim-fact" },
  disputed: { icon: Scale, className: "border-claim-disputed/45 bg-claim-disputed/12 text-claim-disputed" },
  legend: { icon: Star, className: "border-claim-legend/45 bg-claim-legend/12 text-claim-legend" },
  literary: { icon: Feather, className: "border-claim-literary/45 bg-claim-literary/12 text-claim-literary" },
};

export interface ClaimBadgeProps {
  type: ClaimType;
  /** Why this step counts as this type (from data); defaults to the general explanation. */
  why?: string;
  /** Show the "Bu niyə … sayılır?" popover on click/tap. */
  explain?: boolean;
  className?: string;
}

/**
 * Fact / disputed / legend / literary label (§5.5). Never colour alone: icon
 * and word too (§11). With `explain`, a tap opens a short explanation that
 * Escape or a click outside closes.
 */
export function ClaimBadge({ type, why, explain = true, className }: ClaimBadgeProps) {
  const t = useTranslations("ui.claim");
  const help = useTranslations("claims.help");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const popId = useId();
  const { icon: IconCmp, className: tone } = STYLE[type];
  const label = t(type);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const body = (
    <>
      <IconCmp aria-hidden size={14} strokeWidth={2.2} fill={type === "legend" ? "currentColor" : "none"} />
      {label}
    </>
  );
  const pill = cx("inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-13 font-semibold", tone);

  if (!explain) {
    return (
      <span className={cx(pill, className)} data-claim={type}>
        {body}
      </span>
    );
  }

  return (
    <span ref={root} className={cx("relative inline-flex", className)}>
      <button type="button" className={cx(pill, "cursor-help")} data-claim={type} aria-expanded={open} aria-controls={popId} onClick={() => setOpen((v) => !v)}>
        {body}
      </button>
      {open ? (
        <span
          id={popId}
          role="note"
          className="absolute right-0 top-full z-20 mt-2 w-72 rounded-panel border border-line bg-surface-panel p-4 text-left shadow-deep"
        >
          <span className="mb-1.5 block text-14 font-semibold text-fg">{t("why", { type: label.toLocaleLowerCase("az") })}</span>
          <span className="block text-14 leading-relaxed text-fg-secondary">{why ?? help(type)}</span>
        </span>
      ) : null}
    </span>
  );
}
