"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import type { Commemoration, Locale } from "@/domain/schema";
import type { ResolvedRef } from "@/domain/registry";
import { EventIcon } from "@/components/EventIcon";
import { ClaimBadge } from "@/features/claims/ClaimBadge";
import { DividerGlyph } from "@/features/theme/ornaments";
import type { IndexedEvent } from "@/lib/historyIndex";
import { format, t, type Messages } from "@/lib/i18n";
import { commemorationOn, onThisDay, todayFrom, type MonthDay } from "@/lib/onThisDay";

const noop = () => () => {};

/** The date is the visitor's, so the block renders only in the browser (the static HTML holds a placeholder). */
function useToday(): (MonthDay & { year: number }) | null {
  const key = useSyncExternalStore(
    noop,
    () => {
      const d = todayFrom(window.location.search, new Date());
      return `${d.month}-${d.day}-${new Date().getFullYear()}`;
    },
    () => null,
  );
  if (!key) return null;
  const [month, day, year] = key.split("-").map(Number) as [number, number, number];
  return { month, day, year };
}

/**
 * "Tarixdə bu gün": steps from every category that happened on today's day
 * and month, with deep links. No match: "Bu ay tarixdə". Memorial and
 * victory days (27 Sentyabr, 8 Noyabr) get their own design.
 */
export function OnThisDayBlock({
  events,
  commemorations,
  commemorationRefs,
  locale,
  m,
}: {
  events: IndexedEvent[];
  commemorations: Commemoration[];
  commemorationRefs: Record<string, ResolvedRef>;
  locale: Locale;
  m: Messages;
}) {
  const today = useToday();
  const result = useMemo(() => (today ? onThisDay(events, today) : null), [events, today]);
  const special = today ? commemorationOn(commemorations, today) : null;

  if (!today || !result)
    return <section className="paper-card min-h-40 animate-pulse rounded-xl" aria-busy="true" aria-label={m.onThisDay.title} />;

  const dateLabel = `${today.day} ${m.months[today.month - 1]}`;
  const shown = result.events.slice(0, result.mode === "day" ? 6 : 5);
  const ref = special ? commemorationRefs[special.id] : undefined;

  return (
    <section
      className={`relative overflow-hidden rounded-xl p-5 sm:p-6 ${special ? `special-day special-${special.style}` : "paper-card"}`}
      aria-labelledby="otd-title"
      data-testid="on-this-day"
      data-mode={result.mode}
      data-special={special?.id ?? ""}
    >
      {special && (
        <div className="relative mb-4 flex items-start gap-3" data-testid="special-day">
          <span className="shrink-0" style={{ color: special.style === "memorial" ? "#ef3340" : "#00b5e2" }}>
            <DividerGlyph kind="eight-point-star" size={34} />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-80">{dateLabel}</p>
            <h3 className="font-display text-2xl font-semibold">{t(special.title, locale)}</h3>
            <p className="mt-1 text-sm leading-relaxed opacity-90">{t(special.description, locale)}</p>
            {ref?.href && (
              <Link href={`/${locale}${ref.href}`} className="mt-2 inline-block text-sm font-semibold underline underline-offset-2">
                {ref.stepTitle ? t(ref.stepTitle, locale) : t(ref.title, locale)} →
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="relative flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="otd-title" className={`font-display text-2xl font-semibold ${special ? "" : "text-ink"}`}>
          {result.mode === "month" ? m.onThisDay.month : m.onThisDay.title}
        </h2>
        <span className={`text-sm ${special ? "opacity-80" : "text-ink-soft"}`}>
          {result.mode === "month" ? m.months[today.month - 1] : dateLabel}
        </span>
      </div>
      {result.mode === "month" && <p className={`relative mt-1 text-sm ${special ? "opacity-80" : "text-ink-faint"}`}>{format(m.onThisDay.noneToday, { date: dateLabel })}</p>}

      {result.mode === "none" ? (
        <p className="relative mt-3 text-sm text-ink-soft">
          {m.onThisDay.none}{" "}
          <Link href={`/${locale}/timeline/`} className="font-medium text-lapis underline-offset-2 hover:underline">
            {m.timeline.title} →
          </Link>
        </p>
      ) : (
        <ul className="relative mt-4 grid gap-3 sm:grid-cols-2">
          {shown.map((e) => (
            <li key={e.key}>
              <Link href={`/${locale}${e.href}`} className="paper-card group flex h-full gap-3 rounded-lg p-3 text-ink transition-transform hover:-translate-y-0.5" data-testid="otd-event">
                <span className="font-display text-2xl leading-none font-semibold text-carmine tabular-nums">{e.date.year}</span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                    <EventIcon type={e.icon} size={12} />
                    {e.date.day ? `${e.date.day} ${m.months[e.date.month! - 1]}` : m.months[e.date.month! - 1]}
                    {" · "}
                    {format(m.onThisDay.yearsAgo, { n: today.year - e.date.year })}
                    {e.date.certainty !== "exact" && <span className="text-ink-faint">({m.sim.certainty[e.date.certainty]})</span>}
                    {e.claimType !== "fact" && <ClaimBadge type={e.claimType} locale={locale} m={m} size="xs" interactive={false} />}
                  </span>
                  <span className="mt-0.5 block font-medium leading-snug">{t(e.title, locale)}</span>
                  <span className="block text-xs text-ink-faint">{t(e.entityTitle, locale)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
