"use client";

import { useRef } from "react";
import { cx } from "@/lib/cx";

export interface SegmentOption<V extends string> {
  value: V;
  label: React.ReactNode;
  /** Shown but not selectable, e.g. "Ümumi tarix · tezliklə". */
  disabled?: boolean;
}

export interface SegmentedControlProps<V extends string> {
  /** Accessible name of the group. */
  label: string;
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** `pill`: Hekayə/Öyrənmə, Fənn. `tile`: sinif seçimi (6–11). */
  variant?: "pill" | "tile";
  className?: string;
}

const stateClass = (variant: "pill" | "tile", selected: boolean, disabled: boolean) => {
  const tile = variant === "tile";
  if (selected) return cx("bg-accent text-accent-ink", tile && "border-accent");
  if (disabled) return cx("cursor-not-allowed text-fg-muted", tile && "border-fg/10");
  return cx("text-fg hover:bg-fg/8", tile && "border-fg/15");
};

/**
 * Single choice as a radio group: arrow keys move the choice, Tab leaves the
 * group, only the selected option is in the tab order (WAI-ARIA radio pattern).
 */
export function SegmentedControl<V extends string>({ label, options, value, onChange, variant = "pill", className }: SegmentedControlProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.flatMap((o, i) => (o.disabled ? [] : [i]));

  const move = (from: number, delta: number) => {
    const pos = enabled.indexOf(from);
    const next = enabled[(pos + delta + enabled.length) % enabled.length];
    if (next === undefined) return;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={cx(variant === "pill" ? "inline-flex rounded-full border border-fg/15 bg-surface/50 p-1" : "flex flex-wrap gap-2", className)}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={o.disabled || undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => !o.disabled && onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i, -1);
              }
            }}
            className={cx(
              "font-semibold transition-colors duration-200",
              variant === "pill" ? "min-h-10 rounded-full px-4 text-14" : "size-14 rounded-button-lg border text-19 font-medium",
              stateClass(variant, selected, Boolean(o.disabled)),
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
