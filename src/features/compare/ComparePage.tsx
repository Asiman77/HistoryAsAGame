"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Locale, LocalizedText } from "@/domain/schema";
import type { CompareData, CompareOwner } from "@/data/compare";
import { EventIcon } from "@/components/EventIcon";
import { Divider } from "@/components/Ornament";
import { ClaimBadge } from "@/features/claims/ClaimBadge";
import { MiniMap, type MiniLine, type MiniMarker } from "@/features/map/MiniMap";
import { SettingsButton } from "@/features/settings/SettingsPanel";
import { ThemeShell } from "@/features/theme/ThemeShell";
import { axisRange, compareLanes, ownerKey, type LaneEvent, type OwnerType } from "@/lib/compare";
import { formatDate } from "@/lib/dates";
import { format, t, type Messages } from "@/lib/i18n";
import { DEFAULT_THEME_ID } from "@/lib/theme";

/** Fixed lane colours: they must stay apart in every period theme (the theme's own colours change). */
export const LANE_COLORS = { a: "#2f5f9e", b: "#b03a2e" } as const;
const MEET_COLOR = "#b8862b";
const TYPES: OwnerType[] = ["person", "state", "conflict"];

interface Props {
  data: CompareData;
  a: CompareOwner;
  b: CompareOwner;
  /** Shown above the pickers when the link asked for something that does not exist. */
  notice: string | null;
  onPick: (side: "a" | "b", key: string) => void;
  onSwap: () => void;
  locale: Locale;
  messages: Messages;
}

/** Year as a fraction, so steps of one year with known months spread out a little. */
const at = (e: LaneEvent) => e.date.year + (e.date.month ? (e.date.month - 0.5) / 12 : 0.5);

function tickStep(span: number): number {
  if (span <= 60) return 10;
  if (span <= 150) return 25;
  if (span <= 400) return 50;
  return 100;
}

/**
 * Two simulations on one time axis and one map. Lane a is blue, lane b red;
 * meetings (same year and place, or the same battle) are gold and joined
 * across the lanes, places both visited in other years are listed apart.
 */
export function ComparePage({ data, a, b, notice, onPick, onSwap, locale, messages: m }: Props) {
  const tr = (x: LocalizedText) => t(x, locale);
  const cmp = useMemo(() => compareLanes(a, b), [a, b]);
  const range = useMemo(() => axisRange(a, b), [a, b]);
  const span = range.to - range.from;
  const pos = (year: number) => `${((year - range.from) / span) * 100}%`;
  const ticks = useMemo(() => {
    const step = tickStep(span);
    const out: number[] = [];
    for (let y = Math.ceil(range.from / step) * step; y <= range.to; y += step) out.push(y);
    return out;
  }, [range, span]);

  const stepOf = (lane: CompareOwner, id: string) => lane.events.find((e) => e.stepId === id)!;

  // Theme: the one both lanes share, else the step under the pointer, else the neutral one.
  const baseTheme = useMemo(() => {
    const ids = new Set([...a.events, ...b.events].map((e) => e.themeId));
    return ids.size === 1 ? [...ids][0]! : DEFAULT_THEME_ID;
  }, [a, b]);
  const [hoverTheme, setHoverTheme] = useState<string | null>(null);
  const theme = data.themes[hoverTheme ?? baseTheme] ?? data.themes[DEFAULT_THEME_ID]!;

  const map = useMemo(() => {
    const lines: MiniLine[] = [];
    const markers: MiniMarker[] = [];
    for (const [lane, color] of [[a, LANE_COLORS.a], [b, LANE_COLORS.b]] as const) {
      if (lane.path.length > 1) lines.push({ coords: lane.path, color, dashed: lane === b });
      for (const e of lane.events) markers.push({ lng: e.lng, lat: e.lat, color, dot: true });
    }
    const pinned = new Set<string>();
    // Only meetings in one place get a pin: a shared battle may join steps far apart.
    for (const mt of cmp.meetings) {
      if (!mt.reasons.includes("place")) continue;
      const e = stepOf(a, mt.a);
      const id = mt.placeId ?? `${e.lng},${e.lat}`;
      if (pinned.has(id)) continue;
      pinned.add(id);
      markers.push({ lng: e.lng, lat: e.lat, color: MEET_COLOR, label: mt.placeId && data.places[mt.placeId] ? tr(data.places[mt.placeId]!.name) : String(mt.year) });
    }
    for (const sp of cmp.sharedPlaces) {
      const p = data.places[sp.placeId];
      if (!p || pinned.has(sp.placeId)) continue;
      pinned.add(sp.placeId);
      markers.push({ lng: p.lng, lat: p.lat, color: MEET_COLOR, label: tr(p.name) });
    }
    const pts = [...a.events, ...b.events].map((e) => [e.lng, e.lat] as const);
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    const fit: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
    return { lines, markers, fit, center: [(fit[0][0] + fit[1][0]) / 2, (fit[0][1] + fit[1][1]) / 2] as [number, number] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b, cmp, data.places, locale]);

  const gap =
    !cmp.overlap && a.fromYear !== null && b.fromYear !== null && a.toYear !== null && b.toYear !== null
      ? Math.max(b.fromYear - a.toYear, a.fromYear - b.toYear)
      : 0;

  return (
    <ThemeShell theme={theme}>
      <main className="relative mx-auto min-h-full max-w-6xl px-3 pb-16 sm:px-6" data-testid="compare-page">
        <nav className="flex items-center justify-between gap-2 py-3 sm:py-5">
          <Link href={`/${locale}/`} className="paper-card rounded-full px-3 py-1.5 text-sm text-ink-soft hover:text-ink">
            ← {m.categories.home}
          </Link>
          <div className="paper-card rounded-lg p-1">
            <SettingsButton m={m} />
          </div>
        </nav>

        <header className="mb-5">
          <p className="text-xs font-semibold tracking-[0.25em] text-ink-faint uppercase">{m.compare.kicker}</p>
          <h1 className="font-display text-4xl font-semibold text-ink">{m.compare.title}</h1>
          <p className="mt-1 max-w-2xl text-ink-soft">{m.compare.lead}</p>
        </header>

        {notice && (
          <p role="status" className="mb-4 rounded-md border border-gold/50 bg-gold/10 px-4 py-2 text-sm text-ink" data-testid="compare-notice">
            {notice}
          </p>
        )}

        <div className="paper-card grid items-end gap-3 rounded-lg p-4 sm:grid-cols-[1fr_auto_1fr]">
          <Picker side="a" label={m.compare.pickA} value={ownerKey(a.type, a.id)} owners={data.owners} onPick={onPick} locale={locale} m={m} />
          <button
            type="button"
            onClick={onSwap}
            className="justify-self-center rounded-full border border-ink/25 px-3 py-2 text-sm text-ink-soft hover:border-ink hover:text-ink"
            aria-label={m.compare.swap}
            title={m.compare.swap}
            data-testid="compare-swap"
          >
            ⇄
          </button>
          <Picker side="b" label={m.compare.pickB} value={ownerKey(b.type, b.id)} owners={data.owners} onPick={onPick} locale={locale} m={m} />
        </div>

        <p className="mt-4 text-sm text-ink-soft" data-testid="compare-overlap">
          {cmp.overlap ? format(m.compare.overlap, { from: cmp.overlap.from, to: cmp.overlap.to }) : format(m.compare.noOverlap, { gap })}
        </p>

        {/* Shared year axis: two parallel lanes; on narrow screens it scrolls sideways. */}
        <section className="mt-3" aria-labelledby="compare-axis">
          <h2 id="compare-axis" className="sr-only">
            {m.compare.axis}
          </h2>
          <div className="paper-card overflow-x-auto rounded-lg p-4">
            <div className="relative min-w-[40rem] pt-1 pb-7" data-testid="compare-axis">
              {cmp.overlap && (
                <div
                  aria-hidden
                  className="absolute top-0 bottom-6 rounded-sm bg-gold/15"
                  style={{ left: pos(cmp.overlap.from), width: `max(4px, calc(${pos(cmp.overlap.to + 1)} - ${pos(cmp.overlap.from)}))` }}
                />
              )}
              {cmp.meetings.map((mt) => (
                <div
                  key={`${mt.a}|${mt.b}`}
                  aria-hidden
                  className="absolute top-3 bottom-9 w-0.5"
                  style={{ left: pos(at(stepOf(a, mt.a))), background: MEET_COLOR }}
                  data-testid="compare-meeting-line"
                />
              ))}
              {(["a", "b"] as const).map((side) => {
                const lane = side === "a" ? a : b;
                const color = LANE_COLORS[side];
                return (
                  <div key={side} className="relative h-10" data-testid={`compare-lane-${side}`}>
                    <span className="absolute -top-0.5 left-0 z-10 text-xs font-semibold" style={{ color }}>
                      {tr(lane.title)}
                    </span>
                    {lane.fromYear !== null && lane.toYear !== null && (
                      <div
                        aria-hidden
                        className="absolute top-6 h-1.5 rounded-full opacity-40"
                        style={{ left: pos(lane.fromYear), width: `max(6px, calc(${pos(lane.toYear + 1)} - ${pos(lane.fromYear)}))`, background: color }}
                      />
                    )}
                    {lane.events.map((e) => (
                      <Link
                        key={e.key}
                        href={`/${locale}${e.href}`}
                        title={`${formatDate(e.date, m)} · ${tr(e.title)}`}
                        aria-label={`${formatDate(e.date, m)} · ${tr(e.title)}`}
                        onMouseEnter={() => setHoverTheme(e.themeId)}
                        onMouseLeave={() => setHoverTheme(null)}
                        onFocus={() => setHoverTheme(e.themeId)}
                        onBlur={() => setHoverTheme(null)}
                        className="absolute top-[1.15rem] size-3.5 -translate-x-1/2 rounded-full border-2 border-parchment-light transition-transform hover:scale-150 focus-visible:scale-150"
                        style={{ left: pos(at(e)), background: color }}
                      />
                    ))}
                  </div>
                );
              })}
              <div aria-hidden className="absolute right-0 bottom-0 left-0 h-6 border-t border-ink/25">
                {ticks.map((y) => (
                  <span key={y} className="absolute top-1 -translate-x-1/2 text-[10px] text-ink-faint tabular-nums" style={{ left: pos(y) }}>
                    {y}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-6">
            <section aria-labelledby="compare-meetings">
              <h2 id="compare-meetings" className="font-display text-2xl font-semibold text-ink">
                {m.compare.meetings}
              </h2>
              <p className="text-xs text-ink-faint">{m.compare.meetingsHelp}</p>
              {cmp.meetings.length === 0 ? (
                <p className="paper-card mt-3 rounded-md p-4 text-ink-soft" data-testid="compare-no-meetings">
                  {m.compare.noMeetings}
                </p>
              ) : (
                <ul className="mt-3 space-y-3" data-testid="compare-meetings">
                  {cmp.meetings.map((mt) => {
                    const ea = stepOf(a, mt.a);
                    const eb = stepOf(b, mt.b);
                    const battle = mt.battle ? data.battles[mt.battle] : null;
                    return (
                      <li key={`${mt.a}|${mt.b}`} className="paper-card rounded-md p-4" style={{ borderLeft: `4px solid ${MEET_COLOR}` }} data-testid="compare-meeting">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {mt.reasons.map((r) => (
                            <span key={r} className="rounded-sm px-1.5 py-0.5 font-semibold tracking-wide text-parchment-light uppercase" style={{ background: MEET_COLOR }}>
                              {r === "place" ? m.compare.reasonPlace : m.compare.reasonBattle}
                            </span>
                          ))}
                          <span className="font-medium text-ink-soft tabular-nums">{mt.year}</span>
                          {mt.placeId && data.places[mt.placeId] ? (
                            <Link href={`/${locale}/places/${mt.placeId}/`} className="text-lapis underline-offset-2 hover:underline">
                              {tr(data.places[mt.placeId]!.name)}
                            </Link>
                          ) : (
                            mt.reasons.includes("place") && <span className="text-ink-faint">{format(m.compare.near, { km: mt.distanceKm })}</span>
                          )}
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <StepLink e={ea} color={LANE_COLORS.a} locale={locale} m={m} />
                          <StepLink e={eb} color={LANE_COLORS.b} locale={locale} m={m} />
                        </div>
                        {battle && (
                          <p className="mt-2 text-sm">
                            {battle.href ? (
                              <Link href={`/${locale}${battle.href}`} className="font-medium text-lapis underline-offset-2 hover:underline">
                                {m.compare.battle}: {tr(battle.name)} →
                              </Link>
                            ) : (
                              <span className="text-ink-soft">
                                {m.compare.reasonBattle}: {tr(battle.name)}
                              </span>
                            )}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="compare-shared">
              <h2 id="compare-shared" className="font-display text-2xl font-semibold text-ink">
                {m.compare.sharedPlaces}
              </h2>
              <p className="text-xs text-ink-faint">{m.compare.sharedPlacesHelp}</p>
              {cmp.sharedPlaces.length === 0 ? (
                <p className="paper-card mt-3 rounded-md p-4 text-ink-soft">{m.compare.noShared}</p>
              ) : (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="compare-shared">
                  {cmp.sharedPlaces.map((sp) => (
                    <li key={sp.placeId} className="paper-card rounded-md p-4" style={{ borderLeft: `4px dashed ${MEET_COLOR}` }} data-testid="compare-shared-place">
                      <h3 className="font-display text-xl font-semibold text-ink">{data.places[sp.placeId] ? tr(data.places[sp.placeId]!.name) : sp.placeId}</h3>
                      {(["a", "b"] as const).map((side) => (
                        <p key={side} className="mt-1 text-sm">
                          <span className="font-semibold" style={{ color: LANE_COLORS[side] }}>
                            {tr((side === "a" ? a : b).title)}:
                          </span>{" "}
                          {sp[side].map((v, i) => (
                            <span key={v.stepId}>
                              {i > 0 && ", "}
                              <Link href={`/${locale}${stepOf(side === "a" ? a : b, v.stepId).href}`} className="tabular-nums text-ink-soft underline-offset-2 hover:text-ink hover:underline">
                                {v.year}
                              </Link>
                            </span>
                          ))}
                        </p>
                      ))}
                      <Link href={`/${locale}/places/${sp.placeId}/`} className="mt-2 inline-block text-sm font-medium text-lapis underline-offset-2 hover:underline">
                        {m.compare.placeHistory} →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <MiniMap
            center={map.center}
            zoom={4}
            fit={map.fit}
            markers={map.markers}
            lines={map.lines}
            variant={theme.mapStyleVariant}
            className="h-72 lg:sticky lg:top-4 lg:h-[28rem]"
            label={format(m.compare.mapLabel, { a: tr(a.title), b: tr(b.title) })}
            attribution={m.map.attribution}
          />
        </div>

        <Divider className="mx-auto my-10 max-w-xs" />

        <section aria-labelledby="compare-lanes">
          <h2 id="compare-lanes" className="font-display text-2xl font-semibold text-ink">
            {m.compare.lanes}
          </h2>
          <div className="mt-3 grid gap-6 md:grid-cols-2">
            {(["a", "b"] as const).map((side) => {
              const lane = side === "a" ? a : b;
              return (
                <div key={side} data-testid={`compare-list-${side}`}>
                  <h3 className="font-display text-xl font-semibold" style={{ color: LANE_COLORS[side] }}>
                    {tr(lane.title)}
                  </h3>
                  <p className="text-xs text-ink-faint">
                    {lane.fromYear}–{lane.toYear} · {format(m.compare.steps, { n: lane.events.length })}
                  </p>
                  <ol className="mt-3 space-y-2 border-l-2 pl-4" style={{ borderColor: LANE_COLORS[side] }}>
                    {lane.events.map((e) => (
                      <li key={e.key}>
                        <StepLink e={e} color={LANE_COLORS[side]} locale={locale} m={m} />
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </ThemeShell>
  );
}

function Picker({
  side,
  label,
  value,
  owners,
  onPick,
  locale,
  m,
}: {
  side: "a" | "b";
  label: string;
  value: string;
  owners: CompareOwner[];
  onPick: (side: "a" | "b", key: string) => void;
  locale: Locale;
  m: Messages;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-center gap-2 font-medium text-ink-soft">
        <span aria-hidden className="size-3 rounded-full" style={{ background: LANE_COLORS[side] }} />
        {label}
      </span>
      <select
        value={value}
        onChange={(ev) => onPick(side, ev.target.value)}
        className="w-full rounded-md border border-ink/25 bg-parchment-light px-3 py-2 text-ink"
        data-testid={`compare-pick-${side}`}
      >
        {TYPES.map((type) => {
          const group = owners.filter((o) => o.type === type);
          if (group.length === 0) return null;
          return (
            <optgroup key={type} label={m.compare.types[type]}>
              {group.map((o) => (
                <option key={o.id} value={ownerKey(o.type, o.id)}>
                  {t(o.title, locale)} ({o.fromYear}–{o.toYear})
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </label>
  );
}

function StepLink({ e, color, locale, m }: { e: LaneEvent; color: string; locale: Locale; m: Messages }) {
  return (
    <Link href={`/${locale}${e.href}`} className="group flex items-start gap-2 rounded-md p-1.5 hover:bg-ink/5" data-testid="compare-step">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-parchment-light" style={{ background: color }}>
        <EventIcon type={e.icon} size={13} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-ink-faint tabular-nums">
          {formatDate(e.date, m)}
          {e.claimType !== "fact" && (
            <span className="ml-1 inline-block align-middle">
              <ClaimBadge type={e.claimType} locale={locale} m={m} size="xs" interactive={false} />
            </span>
          )}
        </span>
        <span className="block text-sm leading-snug font-medium text-ink group-hover:underline">{t(e.title, locale)}</span>
      </span>
    </Link>
  );
}
