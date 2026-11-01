"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Era, Locale } from "@/domain/schema";
import { EventIcon } from "@/components/EventIcon";
import { t, type Messages } from "@/lib/i18n";
import type { Step } from "./model";

interface Props {
  steps: Step[];
  eras: Era[];
  index: number;
  onSelect: (i: number) => void;
  locale: Locale;
  m: Messages;
  compact?: boolean;
}

/** Evenly spaced life stages; the progress bar is tinted by the era of each stage. */
export function Timeline({ steps, eras, index, onSelect, locale, m, compact = false }: Props) {
  const reduced = useReducedMotion();
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-step="${index}"]`);
    el?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", inline: "center", block: "nearest" });
  }, [index, reduced]);

  const eraFor = (year: number) => eras.find((e) => year >= e.startYear && year <= e.endYear) ?? eras[0];
  const progress = steps.length > 1 ? index / (steps.length - 1) : 1;

  return (
    <nav aria-label={m.sim.timeline} className="relative">
      <ol ref={listRef} className="no-scrollbar relative flex snap-x overflow-x-auto px-6 pt-1 pb-1">
        {steps.map((s, i) => {
          const state = i === index ? "current" : i < index ? "past" : "future";
          const era = eraFor(s.event.date.year);
          return (
            <li key={s.event.id} data-step={i} className="relative flex shrink-0 snap-center flex-col items-center" style={{ width: compact ? 56 : 72 }}>
              {/* connector to the previous node */}
              {i > 0 && (
                <span
                  aria-hidden
                  className="absolute top-[17px] right-1/2 h-[2px] w-full origin-right transition-colors duration-500"
                  style={{ background: i <= index ? (era?.theme.accent ?? "#8a6a2f") : "rgb(42 28 16 / 0.15)" }}
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={state === "current" ? "step" : undefined}
                aria-label={`${s.event.date.year}: ${t(s.event.title, locale)}${s.moments.length ? ` (${m.relations.timelineMark})` : ""}`}
                title={
                  s.moments.length
                    ? `${t(s.event.title, locale)} · ${s.moments.map((mo) => t(mo.person.name, locale)).join(", ")}`
                    : t(s.event.title, locale)
                }
                className="group relative z-10 flex flex-col items-center gap-1 outline-none"
              >
                {s.moments.length > 0 && (
                  <span
                    aria-hidden
                    data-testid="timeline-moment"
                    className="absolute -top-1 right-1 z-20 size-3 rounded-full border-2 border-parchment-light bg-gold shadow"
                  />
                )}
                <motion.span
                  animate={{ scale: state === "current" ? 1.18 : 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  className={`grid size-9 place-items-center rounded-full border-2 transition-colors duration-300 group-focus-visible:ring-2 group-focus-visible:ring-lapis-light ${
                    state === "current"
                      ? "border-carmine bg-carmine text-parchment-light shadow-[0_0_0_4px_rgb(155_44_44/0.18)]"
                      : state === "past"
                        ? "border-ink/60 bg-parchment-light text-ink"
                        : "border-ink/25 bg-parchment-light/80 text-ink-faint group-hover:border-ink/50"
                  }`}
                >
                  <EventIcon type={s.event.type} size={16} />
                </motion.span>
                <span
                  className={`text-[11px] tabular-nums transition-colors ${state === "current" ? "font-semibold text-carmine" : "text-ink-soft"}`}
                >
                  {s.event.date.year}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div aria-hidden className="mx-6 mt-1 h-0.5 overflow-hidden rounded bg-ink/10">
        <motion.div
          className="h-full origin-left bg-carmine/70"
          animate={{ scaleX: progress }}
          transition={{ duration: reduced ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </nav>
  );
}
