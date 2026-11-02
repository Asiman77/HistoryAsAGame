"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale, LocalizedText, Place, Source } from "@/domain/schema";
import type { ResolvedRef } from "@/domain/registry";
import { Divider } from "@/components/Ornament";
import { EventIcon } from "@/components/EventIcon";
import { ClaimBadge } from "@/features/claims/ClaimBadge";
import { MiniMap } from "@/features/map/MiniMap";
import { SettingsButton } from "@/features/settings/SettingsPanel";
import { ArtCredit } from "@/features/theme/Atmosphere";
import { ThemeShell } from "@/features/theme/ThemeShell";
import { formatDate } from "@/lib/dates";
import type { IndexedEvent } from "@/lib/historyIndex";
import { t, type Messages } from "@/lib/i18n";
import type { MembershipSpan } from "@/lib/placeHistory";
import { DEFAULT_THEME_ID, themeVars, type ThemeMap } from "@/lib/theme";

export interface UpcomingItem {
  year: number;
  title: LocalizedText;
  sources: Source[];
  ref: ResolvedRef | null;
}

interface Props {
  place: Place;
  events: IndexedEvent[];
  membership: MembershipSpan[];
  upcoming: UpcomingItem[];
  polityNames: Record<string, LocalizedText>;
  themeId: string;
  themes: ThemeMap;
  locale: Locale;
  messages: Messages;
}

type Row = { kind: "event"; year: number; e: IndexedEvent } | { kind: "upcoming"; year: number; u: UpcomingItem };

const CATEGORY_TONE: Record<IndexedEvent["category"], string> = {
  person: "var(--color-lapis)",
  battle: "var(--color-carmine)",
  state: "var(--color-gold)",
};

/**
 * Place page: names, map, who held the place in each period and a vertical
 * timeline of every simulation step that happened here. Each item wears its
 * own period's colours, and the page theme follows the item in the middle of
 * the screen, so scrolling moves from century to century.
 */
export function PlacePage({ place, events, membership, upcoming, polityNames, themeId, themes, locale, messages: m }: Props) {
  const [active, setActive] = useState(events[0]?.themeId ?? themeId);
  const theme = themes[active] ?? themes[themeId] ?? themes[DEFAULT_THEME_ID]!;
  const listRef = useRef<HTMLOListElement>(null);
  const tr = (x: LocalizedText) => t(x, locale);

  const rows = useMemo<Row[]>(
    () =>
      [
        ...events.map((e) => ({ kind: "event" as const, year: e.date.year, e })),
        ...upcoming.map((u) => ({ kind: "upcoming" as const, year: u.year, u })),
      ].sort((a, b) => a.year - b.year),
    [events, upcoming],
  );

  // The item crossing the middle of the viewport decides the page's period.
  useEffect(() => {
    const items = listRef.current?.querySelectorAll<HTMLElement>("[data-theme-id]");
    if (!items?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((x) => x.isIntersecting).at(-1);
        const id = hit?.target.getAttribute("data-theme-id");
        if (id) setActive(id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    items.forEach((el) => io.observe(el));
    // The last items may never reach the middle of the screen: at the bottom of the page the last one wins.
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        const id = items[items.length - 1]?.getAttribute("data-theme-id");
        if (id) setActive(id);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [rows]);

  return (
    <ThemeShell theme={theme}>
      <main className="relative min-h-full overflow-x-hidden" data-testid="place-page">
        <nav className="flex items-center justify-between gap-2 p-3 sm:p-5">
          <div className="flex flex-wrap gap-2">
            <Link href={`/${locale}/`} className="paper-card rounded-full px-3 py-1.5 text-sm text-ink-soft hover:text-ink">
              ← {m.categories.home}
            </Link>
            <Link href={`/${locale}/places/`} className="paper-card rounded-full px-3 py-1.5 text-sm text-ink-soft hover:text-ink">
              {m.places.allPlaces}
            </Link>
          </div>
          <div className="paper-card rounded-lg p-1">
            <SettingsButton m={m} />
          </div>
        </nav>

        <header className="mx-auto grid max-w-5xl gap-6 px-4 pb-8 sm:px-8 md:grid-cols-[1fr_20rem]">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-ink-faint uppercase">{m.map.placeTypes[place.type]}</p>
            <h1 className="mt-2 font-display text-4xl font-semibold text-ink sm:text-5xl">{tr(place.names.historical)}</h1>
            {place.names.modern && (
              <p className="mt-1 text-sm text-ink-soft">
                {m.places.modernName}: <strong className="font-semibold text-ink">{tr(place.names.modern)}</strong>
              </p>
            )}
            <Divider className="mt-5 max-w-xs" />
            <p className="mt-4 font-serif text-lg leading-relaxed text-ink">{tr(place.description)}</p>
            {!!place.sources?.length && (
              <p className="mt-2 text-xs text-ink-faint">
                {m.places.sources}:{" "}
                {place.sources.map((s, i) => (
                  <span key={i}>
                    {i > 0 && "; "}
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2">
                        {s.title}
                      </a>
                    ) : (
                      s.title
                    )}
                  </span>
                ))}
              </p>
            )}
          </div>
          <MiniMap
            center={[place.lng, place.lat]}
            zoom={5}
            markers={[{ lng: place.lng, lat: place.lat, label: tr(place.names.historical) }]}
            variant={theme.mapStyleVariant}
            className="h-56 md:h-full md:min-h-56"
            label={tr(place.names.historical)}
            attribution={m.map.attribution}
          />
        </header>

        {membership.length > 0 && (
          <section className="mx-auto max-w-5xl px-4 pb-10 sm:px-8" aria-labelledby="membership-title">
            <h2 id="membership-title" className="font-display text-2xl font-semibold text-ink">
              {m.places.membership}
            </h2>
            <p className="mt-1 text-xs text-ink-faint">{m.places.membershipNote}</p>
            <ol className="mt-3 flex flex-wrap gap-2" data-testid="membership">
              {membership.map((s) =>
                s.kind === "gap" ? (
                  <li key={`gap-${s.from}`} className="rounded-md border border-dashed border-ink/25 px-3 py-1.5 text-xs text-ink-faint italic">
                    {s.from}–{s.to}: {m.places.gap}
                  </li>
                ) : (
                  <li key={`${s.polityId}-${s.from}`} className="paper-card flex items-center gap-2 rounded-md px-3 py-1.5 text-sm" data-polity={s.polityId}>
                    <span aria-hidden className="size-3 rounded-full border border-ink/30" style={{ background: s.color }} />
                    <span className="tabular-nums text-ink-soft">
                      {s.from === s.to ? s.from : `${s.from}–${s.to}`}
                    </span>
                    <span className="font-medium text-ink">{tr(s.name)}</span>
                    {s.capital && <span className="rounded-sm bg-gold/20 px-1.5 text-[10px] font-semibold text-ink uppercase">{m.places.capital}</span>}
                    {s.vassalOf && (
                      <span className="text-xs text-ink-faint">
                        ({m.places.vassal}: {polityNames[s.vassalOf] ? tr(polityNames[s.vassalOf]!) : s.vassalOf})
                      </span>
                    )}
                  </li>
                ),
              )}
            </ol>
          </section>
        )}

        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-8" aria-labelledby="timeline-title">
          <h2 id="timeline-title" className="font-display text-2xl font-semibold text-ink">
            {m.places.timeline}
          </h2>
          {rows.length === 0 ? (
            <p className="paper-card mt-4 rounded-md p-5 text-ink-soft" data-testid="place-empty">
              {m.places.empty}
            </p>
          ) : (
            <ol ref={listRef} className="relative mt-6 space-y-5 border-l-2 border-gold/50 pl-6" data-testid="place-timeline">
              {rows.map((row) =>
                row.kind === "event" ? (
                  <EventItem key={row.e.key} e={row.e} themes={themes} locale={locale} m={m} />
                ) : (
                  <li key={`up-${row.year}`} className="relative rounded-md border border-dashed border-ink/25 p-4 text-ink-soft" data-testid="place-upcoming">
                    <span aria-hidden className="absolute top-5 -left-[31px] size-3 rounded-full border-2 border-ink/30 bg-parchment" />
                    <p className="text-xs font-semibold tracking-wide uppercase">
                      {row.year} · {m.places.soon}
                    </p>
                    <p className="mt-1 text-ink">{tr(row.u.title)}</p>
                    {row.u.ref && <p className="mt-1 text-xs">{tr(row.u.ref.title)}</p>}
                  </li>
                ),
              )}
            </ol>
          )}
          <div className="mt-10">
            <ArtCredit theme={theme} locale={locale} label={m.theme} />
          </div>
        </section>
      </main>
    </ThemeShell>
  );
}

function EventItem({ e, themes, locale, m }: { e: IndexedEvent; themes: ThemeMap; locale: Locale; m: Messages }) {
  const theme = themes[e.themeId];
  return (
    <li
      className="theme-scope relative"
      data-theme-id={e.themeId}
      style={theme ? (themeVars(theme, null) as React.CSSProperties) : undefined}
      data-testid="place-event"
    >
      <span aria-hidden className="absolute top-5 -left-[33px] grid size-4 place-items-center rounded-full border-2 border-parchment-light bg-carmine" />
      <Link
        href={`/${locale}${e.href}`}
        className="paper-card group block rounded-md p-4 transition-transform duration-300 hover:-translate-y-0.5"
        style={{ borderLeft: `4px solid ${CATEGORY_TONE[e.category]}` }}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-semibold tracking-wide text-parchment-light uppercase" style={{ background: CATEGORY_TONE[e.category] }}>
            <EventIcon type={e.icon} size={12} />
            {m.places.categories[e.category]}
          </span>
          <span className="font-medium text-ink-soft tabular-nums">{formatDate(e.date, m)}</span>
          {e.claimType !== "fact" && <ClaimBadge type={e.claimType} locale={locale} m={m} size="xs" interactive={false} />}
        </div>
        <h3 className="mt-2 font-display text-xl leading-snug font-semibold text-ink">{t(e.title, locale)}</h3>
        <p className="mt-0.5 text-sm text-ink-soft">{t(e.entityTitle, locale)}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-lapis transition-[gap] group-hover:gap-2">
          {m.places.open} →
        </span>
      </Link>
    </li>
  );
}

