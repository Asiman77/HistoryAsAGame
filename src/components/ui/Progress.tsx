"use client";

import { useTranslations } from "next-intl";
import { cx } from "@/lib/cx";

const pct = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100);

/** Progress ring of a curriculum section (0..1). */
export function ProgressRing({ value, size = 40, stroke = 3, className }: { value: number; size?: number; stroke?: number; className?: string }) {
  const t = useTranslations("ui");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t("progress", { value: pct(value) })} className={cx("shrink-0 -rotate-90", className)}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} className="text-fg" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct(value) / 100)}
        className="text-accent transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  );
}

/** Thin progress bar (a topic in progress). */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const t = useTranslations("ui");
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct(value)}
      aria-label={t("progress", { value: pct(value) })}
      className={cx("h-1 w-30 overflow-hidden rounded-full bg-fg/12", className)}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${pct(value)}%` }} />
    </div>
  );
}

/** Segments for steps or quiz questions: done, current, ahead. */
export function ProgressSegments({ total, done, current, className }: { total: number; done: number; current?: number; className?: string }) {
  const t = useTranslations("ui");
  return (
    <div role="img" aria-label={t("stepOf", { current: (current ?? done) + 1, total })} className={cx("flex gap-1.5", className)}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cx("h-1 flex-1 rounded-full", i < done ? "bg-accent" : i === current ? "bg-accent/60" : "bg-fg/15")} />
      ))}
    </div>
  );
}
