"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { AgePortrait, Locale } from "@/domain/schema";
import { withBasePath } from "@/lib/basePath";
import { format, t, type Messages } from "@/lib/i18n";
import { pickPortrait } from "@/lib/portraits";

/** Respectful stand-in until a portrait file exists: a silhouette in an ornamental frame. */
function Silhouette() {
  return (
    <svg viewBox="0 0 60 75" className="h-full w-full" aria-hidden>
      <rect width="60" height="75" fill="var(--color-parchment-dark, #e6d9bd)" />
      <rect x="3" y="3" width="54" height="69" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" />
      {(
        [
          [3, 3],
          [57, 3],
          [3, 72],
          [57, 72],
        ] as const
      ).map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - 2.5}L${x + 2.5} ${y}L${x} ${y + 2.5}L${x - 2.5} ${y}Z`} fill="currentColor" fillOpacity="0.35" />
      ))}
      <g fill="currentColor" fillOpacity="0.28">
        <ellipse cx="30" cy="27" rx="9.5" ry="11" />
        <path d="M30 40c-12 0-19 7-21 19-.6 4 1 7 1 7h40s1.6-3 1-7c-2-12-9-19-21-19z" />
      </g>
    </svg>
  );
}

/**
 * Portrait for the current age of the person. Changes with a crossfade as the
 * story moves into another age range; AI illustrations always carry their label.
 */
export function PortraitCard({
  portraits,
  age,
  name,
  locale,
  m,
}: {
  portraits: AgePortrait[] | undefined;
  age: number;
  name: string;
  locale: Locale;
  m: Messages;
}) {
  const reduced = useReducedMotion();
  const p = pickPortrait(portraits, age);
  if (!p) return null;
  const key = `${p.ageFrom}-${p.ageTo}`;
  const ai = p.kind === "ai_illustration";
  const credit = [p.author, p.license && `${m.portrait.license}: ${p.license}`].filter(Boolean).join(" · ");

  return (
    <figure
      className="flex items-center gap-3 rounded-sm border border-ink/10 bg-parchment-light/60 p-2"
      data-testid="portrait-card"
      data-portrait={key}
      data-kind={p.kind}
    >
      <div className="relative h-[75px] w-[60px] shrink-0 overflow-hidden rounded-[2px] text-ink shadow-sm">
        <AnimatePresence initial={false}>
          <motion.div
            key={key}
            className="absolute inset-0"
            initial={reduced ? false : { opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
          >
            {p.src ? (
              // eslint-disable-next-line @next/next/no-img-element -- static export, no image optimizer
              <img src={withBasePath(p.src)} alt={t(p.alt, locale)} className="h-full w-full object-cover" />
            ) : (
              <Silhouette />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <figcaption className="min-w-0 text-xs leading-snug">
        <p className="font-semibold text-ink">
          {name} <span className="font-normal text-ink-faint">· {format(m.portrait.ages, { from: p.ageFrom, to: p.ageTo })}</span>
        </p>
        {p.src ? (
          <p className={ai ? "mt-0.5 font-medium text-[var(--mood-accent,var(--color-ink))] italic" : "mt-0.5 text-ink-soft"}>
            {m.portrait.kinds[p.kind]}
          </p>
        ) : (
          <p className="mt-0.5 text-ink-soft italic">{ai ? m.portrait.pendingAi : m.portrait.pending}</p>
        )}
        {p.caption && <p className="mt-0.5 text-ink-soft">{t(p.caption, locale)}</p>}
        {p.src && credit && (
          <p className="mt-0.5 truncate text-[10px] text-ink-faint" title={credit}>
            {p.sourceUrl ? (
              <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted">
                {credit}
              </a>
            ) : (
              credit
            )}
          </p>
        )}
      </figcaption>
    </figure>
  );
}
