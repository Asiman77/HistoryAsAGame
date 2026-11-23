"use client";

import { useTranslations } from "next-intl";
import { BattleSwords, CapitalCrown, City, CrescentStar, Fortress, Port, Shrine } from "@/components/icons";
import { ThemeScope } from "@/components/layout/ThemeScope";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Eyebrow } from "@/components/ui/Eyebrow";
import type { PlaceType } from "@/domain/schema";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { useProgress } from "@/lib/progress";
import type { PersonCardData, PlaceCardData, SimCardData } from "./data";

/** "Davam et · 7/14" or "Tamamlandı" from the viewer's own progress (localStorage). */
function ProgressFlag({ progressKey, steps }: { progressKey: string; steps: number }) {
  const t = useTranslations("home.persons");
  const p = useProgress().persons[progressKey];
  if (!p) return null;
  if (p.completed) return <Badge variant="outline">{t("done")}</Badge>;
  return <Badge variant="accent">{t("continue", { current: Math.min(p.index + 1, steps), total: steps })}</Badge>;
}

/**
 * Person card in the person's own period theme: portrait medallion, years,
 * name, short bio. The whole card is one link; hover lifts it and lights the portrait.
 */
export function PersonCard({ card }: { card: PersonCardData }) {
  const t = useTranslations("home.persons");
  return (
    <ThemeScope themeId={card.themeId} className="h-full">
      <Link href={card.href} className="group block h-full rounded-card focus-visible:outline-offset-4" data-testid="person-card">
        <Card tint interactive padding="none" className="flex h-full min-h-[400px] flex-col">
          <div className="flex items-start justify-between gap-2 p-4">
            <Badge>{card.period}</Badge>
            <ProgressFlag progressKey={card.id} steps={card.steps} />
          </div>
          <div className="flex justify-center px-6 pb-2">
            <div className="relative size-40 rounded-full border border-fg/15 p-2 transition-[transform,box-shadow] duration-500 ease-out group-hover:scale-[1.04] group-hover:shadow-[0_0_60px_-10px_var(--accent)]">
              <div className="absolute inset-1 rounded-full border border-dashed border-accent/30" aria-hidden />
              {card.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element -- static export: images are served as they are
                <img src={card.portrait.src} alt={card.portrait.alt} className="size-full rounded-full object-cover object-top saturate-[.85] transition duration-500 group-hover:saturate-100" loading="lazy" />
              ) : (
                <div className="size-full rounded-full bg-surface/60" aria-hidden />
              )}
            </div>
          </div>
          <div className="mt-auto flex flex-col gap-2 p-6 pt-4">
            <span className="text-13 text-fg-secondary">{card.years}</span>
            <h3 className="m-0 font-heading text-30 font-medium leading-tight text-fg">{card.name}</h3>
            <p className="m-0 line-clamp-3 text-14 text-fg-secondary">{card.bio}</p>
            <span className="mt-2 text-14 font-semibold text-accent group-hover:text-accent-hover">
              {t("live")} <span aria-hidden>→</span>
            </span>
          </div>
        </Card>
      </Link>
    </ThemeScope>
  );
}

/** Diagonal flag stripes of the war card, in the flow so text never runs over them. */
function FlagBand() {
  return (
    <div aria-hidden className="pointer-events-none relative -mx-7 my-3 h-24">
      <div className="absolute inset-x-[-8%] inset-y-0 -rotate-[5deg] opacity-95">
        <div className="h-1/3 bg-flag-blue" />
        <div className="h-1/3 bg-flag-red" />
        <div className="h-1/3 bg-flag-green" />
      </div>
    </div>
  );
}

/** Stylised territory outline of the state card (decorative, not a real border). */
function TerritoryMark() {
  return (
    <svg aria-hidden viewBox="0 0 240 110" className="pointer-events-none absolute bottom-16 right-6 w-56 text-accent/50">
      <path d="M10 70 C 20 30, 70 20, 110 40 S 190 10, 225 40 C 240 60, 220 95, 180 90 S 90 105, 50 95 S 0 95, 10 70 Z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M60 70 C 90 50, 150 45, 190 60" fill="none" stroke="currentColor" strokeDasharray="3 5" strokeWidth="1.5" />
      <circle cx="160" cy="58" r="3.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Card of a war or a state simulation, in its period theme. `war` adds the flag
 * band and the crescent; `state` a stylised territory mark.
 */
export function SimCard({ card, eyebrow, action, variant, progressKey }: { card: SimCardData; eyebrow: string; action: string; variant: "war" | "state"; progressKey: string }) {
  return (
    <ThemeScope themeId={card.themeId} className="h-full">
      <Link href={card.href} className="group block h-full rounded-card focus-visible:outline-offset-4" data-testid={`${variant}-card`}>
        <Card tint padding="lg" interactive className="flex h-full min-h-[360px] flex-col gap-3">
          {variant === "state" ? <TerritoryMark /> : null}
          {variant === "war" ? <CrescentStar size={40} className="absolute right-7 top-7 text-fg" /> : null}
          <div className="relative flex items-center gap-3">
            <Eyebrow>{eyebrow}</Eyebrow>
            <ProgressFlag progressKey={progressKey} steps={card.steps} />
          </div>
          <h3 className="relative m-0 pr-12 font-heading text-30 font-medium leading-tight text-fg sm:text-38">{card.title}</h3>
          <p className="relative m-0 text-15 text-fg-secondary">{card.subtitle}</p>
          {variant === "war" ? <FlagBand /> : null}
          <div className="relative mt-auto flex flex-wrap items-end justify-between gap-4">
            <p className="m-0 line-clamp-2 max-w-sm text-14 text-fg-secondary">{card.description}</p>
            <span className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-accent px-5 text-14 font-semibold text-accent-ink transition-colors group-hover:bg-accent-hover">
              {action} <span aria-hidden className="ml-1.5">→</span>
            </span>
          </div>
        </Card>
      </Link>
    </ThemeScope>
  );
}

const PLACE_ICON: Record<PlaceType, typeof City> = { capital: CapitalCrown, city: City, fortress: Fortress, shrine: Shrine, battlefield: BattleSwords, port: Port };

export function PlaceCard({ place }: { place: PlaceCardData }) {
  const t = useTranslations("collections.places");
  const IconCmp = PLACE_ICON[place.type];
  return (
    <Link
      href={place.href}
      className={cx("group flex min-h-16 items-center gap-4 rounded-panel border border-line bg-surface-raised/60 px-4 py-3 transition-colors hover:border-line-strong hover:bg-surface-raised")}
      data-testid="place-card"
    >
      <IconCmp size={22} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-heading text-19 text-fg">{place.name}</span>
        {place.modern ? <span className="block truncate text-13 text-fg-muted">{place.modern}</span> : null}
      </span>
      {place.events > 0 ? <span className="shrink-0 text-13 text-fg-secondary">{t("events", { n: place.events })}</span> : null}
    </Link>
  );
}
