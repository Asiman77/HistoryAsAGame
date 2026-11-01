"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Locale, Place } from "@/domain/schema";
import { t, type Messages } from "@/lib/i18n";
import { placeNameIn } from "@/lib/places";
import type { Step } from "@/features/simulation/model";
import { placeIconSvg } from "./icons";

interface Props {
  place: Place;
  year: number;
  capital: boolean;
  steps: Step[];
  locale: Locale;
  m: Messages;
  onGoto: (index: number) => void;
  onClose: () => void;
}

/** City card: short history plus what happened here in this person's life. */
export function PlaceCard({ place, year, capital, steps, locale, m, onGoto, onClose }: Props) {
  const reduced = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const here = steps.map((s, i) => ({ s, i })).filter(({ s }) => s.placeId === place.id);
  const type = capital ? "capital" : place.type === "capital" ? "city" : place.type;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, place.id]);

  return (
    <motion.section
      role="dialog"
      aria-modal="false"
      aria-labelledby="place-card-title"
      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="paper-card miniature-frame pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-lg p-5"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 shrink-0" dangerouslySetInnerHTML={{ __html: placeIconSvg(type, 34) }} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-widest text-ink-faint uppercase">{m.map.placeTypes[type]}</p>
          <h2 id="place-card-title" className="font-display text-2xl leading-tight font-semibold text-ink">
            {t(placeNameIn(place, year), locale)}
          </h2>
          {place.names.modern && (
            <p className="text-xs text-ink-soft">
              {m.sim.modernName}: {t(place.names.modern, locale)}
            </p>
          )}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={m.map.close}
          className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink"
        >
          ✕
        </button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink">{t(place.description, locale)}</p>
      <h3 className="mt-4 text-[11px] font-semibold tracking-wider text-ink uppercase">{m.map.placeHere}</h3>
      {here.length ? (
        <ul className="mt-1.5 space-y-1">
          {here.map(({ s, i }) => (
            <li key={s.event.id}>
              <button
                type="button"
                onClick={() => onGoto(i)}
                className="w-full rounded px-2 py-1 text-left text-sm text-lapis hover:bg-lapis/5"
                aria-label={`${m.map.placeGoto}: ${t(s.event.title, locale)}`}
              >
                <span className="tabular-nums text-ink-faint">{s.event.date.year}</span> · {t(s.event.title, locale)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-faint">{m.map.placeNothing}</p>
      )}
      {place.sources?.[0]?.url && (
        <a
          href={place.sources[0].url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-[11px] text-lapis underline decoration-lapis/30 underline-offset-2"
        >
          {place.sources[0].title}
        </a>
      )}
    </motion.section>
  );
}
