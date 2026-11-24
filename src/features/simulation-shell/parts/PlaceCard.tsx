"use client";

import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { placeIconSvg } from "@/features/map/icons";
import { Link } from "@/i18n/navigation";
import type { ShellLandmark, ShellStep } from "../types";
import { SourceLine } from "./StepExtras";

export interface PlaceCardProps {
  place: ShellLandmark;
  year: number;
  /** The place is a capital in the political map of the year. */
  capital: boolean;
  /** Steps of this story (legends may be hidden). */
  steps: ShellStep[];
  onGoto: (index: number) => void;
  onClose: () => void;
}

/**
 * City card (Q6): opens from a marker on the map or the place name in the
 * panel. The period name of the year, the modern name, a short description,
 * what happened here in this story (each a jump to its step) and the way to
 * the place page.
 */
export function PlaceCard({ place, year, capital, steps, onGoto, onClose }: PlaceCardProps) {
  const t = useTranslations("shell");
  const reduced = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const period = place.periods.find((p) => year >= p.from && year <= p.to) ?? place.periods[0];
  const name = period?.name ?? place.modern ?? place.id;
  const type = capital ? "capital" : place.type === "capital" ? "city" : place.type;
  const here = steps.filter((s) => s.placeId === place.id);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, place.id]);

  return (
    <motion.section
      role="dialog"
      aria-modal="false"
      aria-labelledby="place-card-title"
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex max-h-[min(70vh,560px)] flex-col gap-3 overflow-y-auto rounded-panel border border-line-strong bg-surface-panel p-5 shadow-deep"
      data-testid="place-card"
      data-place={place.id}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 shrink-0 rounded-full bg-map-parchment-center p-1" dangerouslySetInnerHTML={{ __html: placeIconSvg(type, 30) }} />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-12 uppercase tracking-[0.16em] text-eyebrow">{t(`place.types.${type}`)}</p>
          <h2 id="place-card-title" className="m-0 font-heading text-26 font-medium leading-tight text-fg">
            {name}
          </h2>
          {place.modern && place.modern !== name ? <p className="m-0 text-13 text-fg-muted">{t("modern", { name: place.modern })}</p> : null}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("place.close")}
          className="-mr-2 -mt-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-fg-secondary hover:bg-fg/5 hover:text-fg"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
      <p className="m-0 text-14 leading-relaxed text-fg-secondary">{place.description}</p>
      {place.href ? (
        <Link href={place.href} className="self-start text-14 font-semibold text-accent underline-offset-2 hover:underline" data-testid="place-history-link">
          {t("place.history")} →
        </Link>
      ) : null}
      <h3 className="m-0 mt-1 text-12 font-semibold uppercase tracking-[0.14em] text-fg">{t("place.here")}</h3>
      {here.length ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {here.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onGoto(s.index)}
                className="flex min-h-10 w-full items-baseline gap-2 rounded-button px-2 text-left text-14 text-fg hover:bg-fg/5"
                aria-label={t("place.goto", { title: s.title })}
              >
                <span className="tabular-nums text-fg-muted">{s.year}</span>
                <span>{s.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-14 text-fg-muted">{t("place.nothing")}</p>
      )}
      {place.source ? (
        <p className="m-0 text-12 text-fg-muted">
          <SourceLine s={place.source} />
        </p>
      ) : null}
    </motion.section>
  );
}
