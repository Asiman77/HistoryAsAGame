"use client";

import { useTranslations } from "next-intl";
import { useMemo, useSyncExternalStore } from "react";
import { ClaimBadge } from "@/components/claims/ClaimBadge";
import { Carnation, CrescentStar } from "@/components/icons";
import { ThemeScope } from "@/components/layout/ThemeScope";
import { Card } from "@/components/ui/Card";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import type { IndexedEvent } from "@/lib/historyIndex";
import { commemorationOn, onThisDay, todayFrom, type MonthDay } from "@/lib/onThisDay";

export interface OnThisDayEvent {
  key: string;
  href: string;
  title: string;
  entityTitle: string;
  date: IndexedEvent["date"];
  claimType: IndexedEvent["claimType"];
}

export interface SpecialDay {
  id: string;
  month: number;
  day: number;
  style: "memorial" | "victory" | "celebration";
  title: string;
  description: string;
  ref: { href: string; label: string } | null;
}

const noop = () => () => {};

/** The visitor's date (or `?today=MM-DD`), known only in the browser. */
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

/** Theme of a special day: the 2020 war for 27 Sentyabr and 8 Noyabr. */
const SPECIAL_THEME = "muasir-zefer";

/**
 * "Tarixdə bu gün" (§6.1): the first event of today's day and month from every
 * category, a few more as links; the month when the day has none; nothing at
 * all when the month has none either. Memorial and victory days get the
 * 2020 theme, the flag edge and their own text.
 */
export function OnThisDayPanel({ events, specials, months }: { events: OnThisDayEvent[]; specials: SpecialDay[]; months: string[] }) {
  const t = useTranslations("home.onThisDay");
  const legacy = useTranslations("onThisDay");
  const today = useToday();
  const result = useMemo(() => (today ? onThisDay(events, today) : null), [events, today]);
  const special = today ? commemorationOn(specials, today) : null;

  if (!today || !result) return <Card padding="lg" className="min-h-72 animate-pulse" aria-busy="true" />;
  if (result.mode === "none" && !special) return null;

  const [first, ...rest] = result.events;
  const dateLabel = `${today.day} ${months[today.month - 1]}`;
  const dateOf = (e: OnThisDayEvent) => (e.date.day ? `${e.date.day} ${months[e.date.month! - 1]}` : months[e.date.month! - 1]);

  const body = (
    <Card
      padding="lg"
      className={cx("flex h-full flex-col gap-4", special && "border-line-strong")}
      data-testid="on-this-day"
      data-mode={result.mode}
      data-special={special?.id ?? ""}
    >
      {special ? <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: "linear-gradient(90deg, var(--flag-blue) 33%, var(--flag-red) 33% 66%, var(--flag-green) 66%)" }} /> : null}
      <Eyebrow>{result.mode === "month" ? t("month") : t("day")}</Eyebrow>
      <p className="m-0 font-heading text-22 text-fg-secondary">{result.mode === "month" ? months[today.month - 1] : dateLabel}</p>

      {special ? (
        <div className="flex gap-3" data-testid="special-day">
          {special.style === "memorial" ? <Carnation size={30} className="shrink-0 text-flag-red" /> : <CrescentStar size={30} className="shrink-0 text-fg" />}
          <div className="flex flex-col gap-1">
            <h2 className="m-0 font-heading text-30 font-medium leading-tight text-fg">{special.title}</h2>
            <p className="m-0 text-14 text-fg-secondary">{special.description}</p>
            {special.ref ? (
              <Link href={special.ref.href} className="text-14 font-semibold text-accent hover:text-accent-hover">
                {special.ref.label} <span aria-hidden>→</span>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {first ? (
        <>
          {result.mode === "month" ? <p className="m-0 text-13 text-fg-muted">{legacy("noneToday", { date: dateLabel })}</p> : null}
          <Link href={first.href} className="group flex flex-col gap-2" data-testid="otd-event">
            {!special ? <h2 className="m-0 font-heading text-30 font-medium leading-tight text-fg group-hover:text-accent">{first.title}</h2> : <span className="font-heading text-22 text-fg group-hover:text-accent">{first.title}</span>}
            <span className="flex flex-wrap items-center gap-2 text-14 text-fg-secondary">
              {first.date.year} · {first.entityTitle} · {legacy("yearsAgo", { n: today.year - first.date.year })}
              {first.claimType !== "fact" ? <ClaimBadge type={first.claimType} explain={false} /> : null}
            </span>
            <span className="text-14 font-semibold text-accent">
              {t("go")} <span aria-hidden>→</span>
            </span>
          </Link>
          {rest.length ? (
            <ul className="m-0 mt-2 flex list-none flex-col gap-2 border-t border-line p-0 pt-4">
              {rest.slice(0, 3).map((e) => (
                <li key={e.key}>
                  <Link href={e.href} className="flex gap-3 text-14 text-fg-secondary hover:text-accent" data-testid="otd-event">
                    <span className="w-24 shrink-0 font-heading text-fg">
                      {result.mode === "month" ? dateOf(e) : e.date.year}
                    </span>
                    <span>
                      {e.title} · {e.entityTitle}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </Card>
  );

  return special ? (
    <ThemeScope themeId={SPECIAL_THEME} className="h-full">
      {body}
    </ThemeScope>
  ) : (
    body
  );
}
