"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { cx } from "@/lib/cx";
import type { ShellStep } from "../types";
import { TONE_BG, TONE_BORDER, moodTone } from "./mood";

/**
 * "Həyat yolu" (§5.1): one node per visible step, mood-coloured dots, the
 * passed part of the line in the period gradient, the current node large.
 * Nodes are buttons; the strip scrolls sideways and keeps the current node in view.
 */
export function ShellTimeline({ steps, current, onSelect }: { steps: ShellStep[]; current: number; onSelect: (index: number) => void }) {
  const t = useTranslations("shell");
  const list = useRef<HTMLOListElement>(null);
  const pos = Math.max(0, steps.findIndex((s) => s.index === current));
  const progress = steps.length > 1 ? pos / (steps.length - 1) : 1;

  useEffect(() => {
    const node = list.current?.querySelector<HTMLElement>('[aria-current="step"]');
    node?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [current]);

  return (
    <nav aria-label={t("timeline")} className="relative z-10 shrink-0 border-t border-line bg-surface-panel/95 px-4 pb-4 pt-3 backdrop-blur-md md:px-7" data-testid="shell-timeline">
      <div className="flex items-center justify-between text-12 uppercase tracking-[0.18em] text-fg-secondary">
        <span>{t("timeline")}</span>
        <span className="hidden md:inline">{t("keyboardHint")}</span>
      </div>
      <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        <ol ref={list} className="relative m-0 flex min-w-full list-none p-0 pt-4" style={{ width: `max(100%, ${steps.length * 108}px)` }}>
          <span aria-hidden className="absolute left-[54px] right-[54px] top-[27px] h-0.5 bg-fg/15" />
          <span
            aria-hidden
            className="absolute left-[54px] top-[27px] h-0.5"
            style={{ width: `calc((100% - 108px) * ${progress})`, background: "linear-gradient(90deg, var(--secondary-2), var(--accent))" }}
          />
          {steps.map((s, i) => {
            const tone = moodTone(s.mood);
            const isCurrent = s.index === current;
            const passed = i < pos;
            return (
              <li key={s.id} className="flex flex-1 justify-center">
                <button
                  type="button"
                  onClick={() => onSelect(s.index)}
                  aria-current={isCurrent ? "step" : undefined}
                  className="group flex min-h-11 w-[104px] flex-col items-center gap-1.5 rounded-button px-1 pb-1 text-center"
                >
                  <span className="flex h-6 items-center">
                    <span
                      aria-hidden
                      className={cx(
                        "rounded-full transition-all duration-300",
                        isCurrent ? "size-6 border-[3px] border-accent/40 bg-accent ring-4 ring-accent/15" : passed ? cx("size-3.5", TONE_BG[tone]) : cx("size-3.5 border-2 bg-surface-panel", TONE_BORDER[tone], "opacity-70"),
                      )}
                    />
                  </span>
                  <span className={cx("text-13 tabular-nums", isCurrent ? "font-semibold text-fg" : "text-fg-secondary")}>{s.year}</span>
                  <span className={cx("line-clamp-1 text-12", isCurrent ? "font-semibold text-accent" : "text-fg-muted group-hover:text-fg-secondary")}>{s.nodeLabel}</span>
                  <span className="sr-only"> · {s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
