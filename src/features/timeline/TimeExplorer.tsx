"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/domain/schema";
import type { TimeExplorerData } from "@/data/timeExplorer";
import { EventIcon } from "@/components/EventIcon";
import { ClaimBadge } from "@/features/claims/ClaimBadge";
import { PolityPanel } from "@/features/map/PolityPanel";
import { ThemeShell, useCalmVisuals } from "@/features/theme/ThemeShell";
import { formatDate } from "@/lib/dates";
import { format, t, type Messages } from "@/lib/i18n";
import { DEFAULT_THEME_ID, eraForYear, themeVars } from "@/lib/theme";
import {
  eraSegments,
  eventsInYear,
  nearestEventYears,
  personsInYear,
  reignsInYear,
  snapshotForYear,
  yearToPercent,
} from "@/lib/timeSlider";
import { TimeMap } from "./TimeMap";

interface Props {
  data: TimeExplorerData;
  locale: Locale;
  messages: Messages;
  initialYear: number;
  /** Home page: shorter map, no side panels, a link to the full page. */
  compact?: boolean;
  /** Keep ?year= in the address bar (the /timeline page). */
  syncUrl?: boolean;
}

/** Wait until the value has been still for `ms` (heavier work follows the thumb, not every pixel). */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/**
 * Global time slider: drag through 1400–2020 and the map shows that year's
 * borders, capitals and the persons alive (with their age), next to the
 * rulers of the year and its events from every category. Years the maps do
 * not cover say so instead of showing an empty map.
 */
export function TimeExplorer({ data, locale, messages: m, initialYear, compact = false, syncUrl = false }: Props) {
  const [year, setYear] = useState(initialYear);
  // The thumb and the year label follow instantly; lists use the deferred value,
  // borders and theme wait until the slider rests (keeps dragging at 60 fps).
  const deferred = useDeferredValue(year);
  const settled = useSettled(year, 140);
  const themeYear = useSettled(year, 320);
  const [polityId, setPolityId] = useState<string | null>(null);
  const { light } = useCalmVisuals();
  const router = useRouter();

  const pick = useMemo(() => snapshotForYear(settled, data.snapshots), [settled, data.snapshots]);
  const snapshot = data.snapshots.find((s) => s.id === pick.id) ?? null;
  const era = eraForYear(data.eras, themeYear);
  const theme = data.themes[era?.themeId ?? DEFAULT_THEME_ID] ?? data.themes[DEFAULT_THEME_ID]!;

  const persons = useMemo(() => personsInYear(deferred, data.persons), [deferred, data.persons]);
  const events = useMemo(() => eventsInYear(deferred, data.events), [deferred, data.events]);
  const nearest = useMemo(() => (events.length ? null : nearestEventYears(deferred, data.events)), [events.length, deferred, data.events]);
  const reigns = useMemo(() => {
    const onMap = new Set(snapshot?.polities.map((p) => p.id) ?? []);
    return reignsInYear(deferred, data.political.reigns).sort((a, b) => Number(onMap.has(b.polityId)) - Number(onMap.has(a.polityId)));
  }, [deferred, data.political.reigns, snapshot]);
  const segments = useMemo(() => eraSegments(data.eras, data.from, data.to), [data.eras, data.from, data.to]);
  const covered = pick.covered && !!snapshot;

  useEffect(() => {
    if (!syncUrl) return;
    const url = new URL(window.location.href);
    url.searchParams.set("year", String(settled));
    window.history.replaceState(window.history.state, "", url);
  }, [settled, syncUrl]);

  const jump = useCallback((y: number) => setYear(Math.max(data.from, Math.min(data.to, y))), [data.from, data.to]);
  const polity = (id: string) => data.political.polities.find((p) => p.id === id);
  const ruler = (id: string) => data.political.rulers.find((r) => r.id === id);

  const slider = (
    <div className="px-1" data-testid="year-slider">
      <div className="flex items-end justify-between gap-3">
        <output htmlFor="year-input" className="font-display text-5xl font-semibold text-ink tabular-nums" data-testid="year-value" aria-live="off">
          {year}
        </output>
        <div className="flex gap-1.5">
          <button type="button" className="btn-secondary px-3 py-1 text-sm" onClick={() => jump(year - 10)} aria-label={format(m.timeline.back, { n: 10 })}>
            −10
          </button>
          <button type="button" className="btn-secondary px-3 py-1 text-sm" onClick={() => jump(year - 1)} aria-label={format(m.timeline.back, { n: 1 })}>
            −1
          </button>
          <button type="button" className="btn-secondary px-3 py-1 text-sm" onClick={() => jump(year + 1)} aria-label={format(m.timeline.forward, { n: 1 })}>
            +1
          </button>
          <button type="button" className="btn-secondary px-3 py-1 text-sm" onClick={() => jump(year + 10)} aria-label={format(m.timeline.forward, { n: 10 })}>
            +10
          </button>
        </div>
      </div>
      <input
        id="year-input"
        type="range"
        min={data.from}
        max={data.to}
        step={1}
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="year-range mt-2"
        aria-label={m.timeline.year}
        aria-valuetext={String(year)}
      />
      {/* Eras as coloured bands; a click jumps to the start of the era. */}
      <div className="relative mt-1 h-7" role="group" aria-label={m.timeline.eras}>
        {segments.map((s) =>
          s.kind === "era" ? (
            <button
              key={s.era.id}
              type="button"
              onClick={() => jump(s.from)}
              className="absolute top-0 h-full overflow-hidden rounded-sm px-1 text-left text-[10px] leading-7 font-semibold whitespace-nowrap text-white uppercase shadow-sm hover:brightness-110"
              style={{ left: `${yearToPercent(s.from, data.from, data.to)}%`, width: `${yearToPercent(s.to + 1, data.from, data.to) - yearToPercent(s.from, data.from, data.to)}%`, background: s.era.color }}
              title={`${t(s.era.name, locale)} (${s.era.startYear}–${s.era.endYear})`}
              data-testid="era-band"
            >
              {t(s.era.name, locale)}
            </button>
          ) : (
            <span
              key={`gap-${s.from}`}
              aria-hidden
              className="absolute top-2.5 h-2 rounded-sm"
              style={{
                left: `${yearToPercent(s.from, data.from, data.to)}%`,
                width: `${yearToPercent(s.to + 1, data.from, data.to) - yearToPercent(s.from, data.from, data.to)}%`,
                background: "repeating-linear-gradient(45deg, rgb(42 28 16 / 0.18) 0 4px, transparent 4px 8px)",
              }}
            />
          ),
        )}
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-ink-faint tabular-nums">
        <span>{data.from}</span>
        <span>{data.to}</span>
      </div>
    </div>
  );

  const gapCard = !covered && (
    <div className="paper-card absolute inset-x-4 top-4 z-10 mx-auto max-w-md rounded-lg p-4 text-center" data-testid="coverage-gap">
      <p className="font-display text-lg font-semibold text-ink">{m.timeline.gap}</p>
      <p className="mt-1 text-sm text-ink-soft">{m.timeline.gapHelp}</p>
      <div className="mt-3 flex justify-center gap-2">
        {pick.prevYear !== null && (
          <button type="button" className="btn-secondary text-sm" onClick={() => jump(pick.prevYear!)}>
            ← {pick.prevYear}
          </button>
        )}
        {pick.nextYear !== null && (
          <button type="button" className="btn-secondary text-sm" onClick={() => jump(pick.nextYear!)}>
            {pick.nextYear} →
          </button>
        )}
      </div>
    </div>
  );

  const map = (
    <div className={`relative ${compact ? "h-[46vh] min-h-72" : "h-[58vh] min-h-80"}`}>
      <TimeMap
        snapshot={snapshot}
        faded={!covered}
        persons={persons}
        landmarks={data.landmarks}
        variant={theme.mapStyleVariant}
        light={light}
        locale={locale}
        label={format(m.timeline.mapLabel, { year: settled })}
        onSelectPolity={setPolityId}
      />
      {gapCard}
      {snapshot && covered && (
        <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-parchment-light/85 px-2 py-0.5 text-[11px] text-ink-soft">
          {m.timeline.mapOf}: {t(snapshot.title, locale)} ({snapshot.year})
        </p>
      )}
      {polityId && !compact && (
        <div className="absolute top-3 left-3 z-20 max-h-[calc(100%-1.5rem)] overflow-y-auto">
          <PolityPanel
            polityId={polityId}
            year={settled}
            step={null}
            snapshot={snapshot}
            political={data.political}
            landmarks={data.landmarks}
            currentPersonHref={null}
            locale={locale}
            m={m}
            onFollow={(href) => router.push(`/${locale}${href}`)}
            onClose={() => setPolityId(null)}
          />
        </div>
      )}
    </div>
  );

  const body = compact ? (
    <section className="flex flex-col gap-3" data-testid="time-explorer" data-compact="true">
      {map}
      {slider}
      <p className="text-sm text-ink-soft">
        {era ? t(era.name, locale) : m.timeline.noEra}
        {" · "}
        {format(m.timeline.summary, { rulers: reigns.length, persons: persons.length, events: events.length })}
        {" · "}
        <Link href={`/${locale}/timeline/?year=${settled}`} className="font-medium text-lapis underline-offset-2 hover:underline">
          {m.timeline.openFull} →
        </Link>
      </p>
    </section>
  ) : (
    <section className="grid gap-5 lg:grid-cols-[1fr_22rem]" data-testid="time-explorer">
      <div className="flex flex-col gap-4">
        {map}
        <div className="paper-card rounded-lg p-4">{slider}</div>
      </div>
      <aside className="flex flex-col gap-4">
        <Panel title={m.timeline.rulers} empty={m.timeline.noRulers} testId="year-rulers">
          {reigns.slice(0, 14).map((r) => {
            const p = polity(r.polityId);
            const ru = ruler(r.rulerId);
            return (
              <li key={`${r.polityId}-${r.rulerId}-${r.start.year}`}>
                <button type="button" onClick={() => setPolityId(r.polityId)} className="flex w-full items-start gap-2 rounded px-1 py-0.5 text-left hover:bg-ink/5">
                  <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: p?.color ?? "#888" }} />
                  <span className="text-sm">
                    <span className="font-medium text-ink">{ru ? t(ru.name, locale) : r.rulerId}</span>
                    <span className="block text-xs text-ink-faint">
                      {p ? t(p.name, locale) : r.polityId} · {r.start.year}–{r.end.year}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </Panel>
        <Panel title={m.timeline.persons} empty={m.timeline.noPersons} testId="year-persons">
          {persons.map((p) => (
            <li key={p.person.id}>
              <Link href={`/${locale}${p.person.href}`} className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-sm hover:bg-ink/5">
                <span className="font-medium text-ink">{t(p.person.name, locale)}</span>
                <span className="text-xs text-ink-soft">{format(m.timeline.age, { age: `${p.approximate ? "~" : ""}${p.age}` })}</span>
              </Link>
            </li>
          ))}
        </Panel>
        <Panel title={format(m.timeline.events, { year: deferred })} empty={m.timeline.noEvents} testId="year-events">
          {events.map((e) => (
            <li key={e.key}>
              <Link href={`/${locale}${e.href}`} className="block rounded px-1 py-1 hover:bg-ink/5">
                <span className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <EventIcon type={e.icon} size={12} /> {formatDate(e.date, m)}
                  {e.claimType !== "fact" && <ClaimBadge type={e.claimType} locale={locale} m={m} size="xs" interactive={false} />}
                </span>
                <span className="block text-sm font-medium text-ink">{t(e.title, locale)}</span>
                <span className="block text-xs text-ink-faint">{t(e.entityTitle, locale)}</span>
              </Link>
            </li>
          ))}
        </Panel>
        {nearest && (nearest.prev !== null || nearest.next !== null) && (
          <div className="flex justify-between gap-2 text-sm" data-testid="nearest-events">
            {nearest.prev !== null ? (
              <button type="button" className="text-lapis hover:underline" onClick={() => jump(nearest.prev!)}>
                ← {nearest.prev}
              </button>
            ) : (
              <span />
            )}
            {nearest.next !== null && (
              <button type="button" className="text-lapis hover:underline" onClick={() => jump(nearest.next!)}>
                {nearest.next} →
              </button>
            )}
          </div>
        )}
      </aside>
    </section>
  );

  return compact ? (
    // On the home page the slider tints only its own box, not the whole page.
    <div className="theme-scope paper-card rounded-xl p-3 sm:p-4" style={themeVars(theme, null) as React.CSSProperties} data-theme-id={theme.id}>
      {body}
    </div>
  ) : (
    <ThemeShell theme={theme} variant="page">
      {body}
    </ThemeShell>
  );
}

function Panel({ title, empty, testId, children }: { title: string; empty: string; testId: string; children: React.ReactNode[] }) {
  return (
    <section className="paper-card rounded-lg p-4" data-testid={testId}>
      <h2 className="text-xs font-semibold tracking-wider text-ink uppercase">{title}</h2>
      {children.length ? <ul className="mt-2 space-y-1">{children}</ul> : <p className="mt-2 text-sm text-ink-faint">{empty}</p>}
    </section>
  );
}
