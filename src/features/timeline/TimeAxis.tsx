"use client";

import { useTranslations } from "next-intl";
import { useMemo, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { GRADES } from "@/lib/grades";
import { cx } from "@/lib/cx";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { formatYear } from "@/lib/historicalDate";
import { ordinal } from "@/lib/ordinal";
import { axisTicks, nextYear, type TimeScale } from "@/lib/timeScale";
import type { ZamanData } from "./data";

export interface TimeAxisProps {
  data: Pick<ZamanData, "eras" | "states" | "stateRows" | "events" | "persons">;
  scale: TimeScale;
  year: number;
  /** Era name of the year, for the slider's spoken value. */
  eraName: string | null;
  /** Zoomed into an era (its id), or showing all of them. */
  zoomedEra: string | null;
  onYear: (year: number) => void;
  onZoom: (eraId: string | null) => void;
  onPolity: (polityId: string) => void;
}

const pct = (x: number) => `${(x * 100).toFixed(3)}%`;
const LABEL_COL = "grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[140px_minmax(0,1fr)]";

/**
 * Bottom of the timeline (§6.2): grade filter and subject, era bands (a click
 * zooms into the era), the lanes of states, events and persons, the axis and
 * the year slider. The slider is a real `role="slider"`: ← → one year,
 * Shift ten, PageUp/PageDown the next or previous era, Home/End the ends.
 * Lanes answer the mouse; the keyboard drives the year through the slider.
 */
export function TimeAxis({ data, scale, year, eraName, zoomedEra, onYear, onZoom, onPolity }: TimeAxisProps) {
  const t = useTranslations("zaman");
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const x = scale.yearToX(year);
  const visible = (from: number, to: number) => to >= scale.from && from <= scale.to;
  const span = (from: number, to: number) => {
    const a = scale.yearToX(from);
    return { left: pct(a), width: pct(Math.max(scale.yearToX(nextYear(to)) - a, 0.002)) };
  };
  // Year labels need about 50 px each: fewer of them on a phone.
  const wide = useMediaQuery("(min-width: 640px)", true);
  const ticks = useMemo(() => axisTicks(scale, wide ? 0.07 : 0.2), [scale, wide]);
  const eventYears = useMemo(() => {
    const byYear = new Map<number, number>();
    for (const e of data.events) byYear.set(e.year, (byYear.get(e.year) ?? 0) + 1);
    return [...byYear.entries()].map(([y, n]) => ({ year: y, n }));
  }, [data.events]);

  const yearAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return scale.xToYear((clientX - r.left) / r.width);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onYear(yearAt(e.clientX));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) onYear(yearAt(e.clientX));
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  const eraStarts = scale.segments.map((s) => s.from);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    let to: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") to = nextYear(year, e.shiftKey ? 10 : 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = nextYear(year, e.shiftKey ? -10 : -1);
    else if (e.key === "PageUp") to = eraStarts.find((s) => s > year) ?? scale.to;
    else if (e.key === "PageDown") to = [...eraStarts].reverse().find((s) => s < year) ?? scale.from;
    else if (e.key === "Home") to = scale.from;
    else if (e.key === "End") to = scale.to;
    if (to === null) return;
    e.preventDefault();
    onYear(Math.min(Math.max(to, scale.from), scale.to));
  };

  return (
    <section
      aria-label={t("axisLabel")}
      className="flex flex-col gap-3 border-t border-line px-4 pb-5 pt-4 sm:px-7"
      style={{ background: "linear-gradient(180deg, var(--bg-panel) 0%, color-mix(in srgb, var(--bg-base) 85%, black) 100%)" }}
      data-testid="time-axis"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t("grades")} className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onZoom(null)}
            aria-pressed={!zoomedEra}
            className={cx(
              "min-h-9 rounded-full px-3.5 text-13 transition-colors",
              !zoomedEra ? "bg-accent font-semibold text-accent-ink" : "border border-fg/20 text-fg-secondary hover:border-line-strong hover:text-fg",
            )}
            data-testid="all-eras"
          >
            {t("allEras")}
          </button>
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              disabled
              title={t("gradesSoon")}
              className="hidden min-h-9 cursor-not-allowed rounded-full border border-dashed border-fg/20 px-3.5 text-13 text-fg-muted sm:inline-flex sm:items-center"
            >
              {t("grade", { grade: ordinal(g) })}
            </button>
          ))}
          <span className="self-center text-12 text-fg-muted">{t("gradesSoon")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-12 text-fg-muted">{t("scaleNote")}</span>
          <div role="group" aria-label={t("subject")} className="flex items-center gap-1 rounded-full border border-fg/12 bg-black/30 p-1" data-testid="subject-switch">
            <button type="button" aria-pressed className="min-h-8 rounded-full bg-accent px-3.5 text-13 font-semibold text-accent-ink">
              {t("subjects.azerbaijan")}
            </button>
            <button type="button" disabled className="min-h-8 cursor-not-allowed rounded-full px-3.5 text-13 text-fg-muted">
              {t("subjects.world")} · {t("soon")}
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex flex-col gap-2">
        {/* Era bands */}
        <div className={LABEL_COL}>
          <span className="text-12 text-fg-muted">{t("lanes.eras")}</span>
          <div className="relative h-12 overflow-hidden rounded-button-lg" data-testid="era-bands">
            {scale.segments.map((s) => {
              const era = s.eraId ? data.eras.find((e) => e.id === s.eraId) : undefined;
              const style = { left: pct(s.x0), width: pct(s.x1 - s.x0) };
              return era ? (
                <button
                  key={`${s.from}-${era.id}`}
                  type="button"
                  onClick={() => onZoom(zoomedEra === era.id ? null : era.id)}
                  aria-pressed={zoomedEra === era.id}
                  aria-label={t("zoomEra", { era: era.name, from: formatYear(era.from), to: formatYear(era.to) })}
                  className={cx(
                    "absolute inset-y-0 flex items-center justify-center overflow-hidden px-1 text-center text-12 font-semibold leading-tight transition-[filter]",
                    era.lightBand ? "text-surface" : "text-fg",
                    "hover:brightness-125 focus-visible:z-10",
                    zoomedEra === era.id && "shadow-[inset_0_0_0_2px_var(--accent)]",
                  )}
                  style={{ ...style, background: era.color }}
                  data-era={era.id}
                >
                  <span className="truncate">{era.name}</span>
                </button>
              ) : (
                <span
                  key={`gap-${s.from}`}
                  className="absolute inset-y-0 flex items-center justify-center border-x border-dashed border-fg/15 bg-fg/5 text-12 text-fg-muted"
                  style={style}
                  title={t("gap", { from: formatYear(s.from), to: formatYear(s.to) })}
                >
                  <span className="sr-only">{t("gap", { from: formatYear(s.from), to: formatYear(s.to) })}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Lanes: mouse shortcuts; the slider below is the keyboard way. */}
        <div className={LABEL_COL}>
          <span className="text-12 text-fg-muted">{t("lanes.states")}</span>
          <div className="relative" style={{ height: Math.max(1, data.stateRows) * 10 - 2 }} data-testid="lane-states">
            {data.states
              .filter((b) => visible(b.from, b.to))
              .map((b) => (
                <button
                  key={`${b.polityId ?? "group"}-${b.from}-${b.row}`}
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    onYear(Math.min(Math.max(year, b.from), b.to));
                    if (b.polityId) onPolity(b.polityId);
                  }}
                  title={b.group ? `${t("statesGroup", { n: b.group.length })}: ${b.group.join(", ")}` : `${b.name} · ${formatYear(b.from)}–${formatYear(b.to)}`}
                  aria-label={b.group ? t("statesGroup", { n: b.group.length }) : b.name}
                  className={cx("absolute h-2 rounded-full hover:brightness-125", b.group && "opacity-70")}
                  style={{ ...span(b.from, b.to), top: b.row * 10, background: b.group ? "color-mix(in srgb, var(--fg) 35%, transparent)" : b.color }}
                  data-polity={b.polityId ?? undefined}
                />
              ))}
          </div>
        </div>
        <div className={LABEL_COL}>
          <span className="text-12 text-fg-muted">{t("lanes.events")}</span>
          <div className="relative h-[18px]" data-testid="lane-events">
            {eventYears
              .filter((e) => visible(e.year, e.year))
              .map((e) => (
                <button
                  key={e.year}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onYear(e.year)}
                  title={t("eventsOfYear", { year: formatYear(e.year), n: e.n })}
                  aria-label={t("eventsOfYear", { year: formatYear(e.year), n: e.n })}
                  className={cx(
                    "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                    e.year === year ? "size-[18px] bg-fg shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_40%,transparent)]" : "size-2.5 bg-accent/80 hover:bg-accent",
                  )}
                  style={{ left: pct(scale.yearCenterX(e.year)) }}
                />
              ))}
          </div>
        </div>
        <div className={LABEL_COL}>
          <span className="text-12 text-fg-muted">{t("lanes.persons")}</span>
          <div className="relative h-[22px]" data-testid="lane-persons">
            {data.persons
              .filter((p) => visible(p.from, p.to))
              .map((p) => {
                const alive = year >= p.from && year <= p.to;
                return (
                  <button
                    key={p.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => onYear(alive ? year : p.from)}
                    title={`${p.name} · ${formatYear(p.from)}–${formatYear(p.to)}`}
                    aria-label={p.name}
                    className="absolute top-1 flex h-3.5 items-center overflow-hidden rounded-full border px-1.5 text-[10px] leading-none text-fg"
                    style={{ ...span(p.from, p.to), borderColor: p.color, background: alive ? `color-mix(in srgb, ${p.color} 50%, transparent)` : "transparent" }}
                    data-person={p.id}
                  >
                    <span className="truncate">{p.name}</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Axis and slider */}
        <div className={LABEL_COL}>
          <span />
          <div
            ref={track}
            className="relative h-10 cursor-pointer touch-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            data-testid="axis-track"
          >
            <div aria-hidden className="absolute inset-x-0 top-2 h-0.5 bg-fg/20" />
            {ticks.map((tk) => (
              <span
                key={tk.year}
                aria-hidden
                className={cx("absolute top-5 whitespace-nowrap text-12 text-fg-muted", tk.x === 0 ? "" : tk.x === 1 ? "-translate-x-full" : "-translate-x-1/2")}
                style={{ left: pct(tk.x) }}
              >
                {formatYear(tk.year)}
              </span>
            ))}
            <div aria-hidden className="pointer-events-none absolute bottom-[calc(100%-8px)] h-[190px] w-0.5 -translate-x-1/2 bg-gradient-to-b from-transparent to-accent" style={{ left: pct(x) }} />
            <div
              role="slider"
              tabIndex={0}
              aria-label={t("slider")}
              aria-valuemin={scale.from}
              aria-valuemax={scale.to}
              aria-valuenow={year}
              aria-valuetext={eraName ? t("sliderValue", { year: formatYear(year), era: eraName }) : formatYear(year)}
              aria-keyshortcuts="ArrowLeft ArrowRight PageUp PageDown Home End"
              onKeyDown={onKey}
              className="absolute top-2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_5px_color-mix(in_srgb,var(--accent)_25%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg"
              style={{ left: pct(x) }}
              data-testid="year-slider"
            />
          </div>
        </div>
      </div>
      <p className="m-0 text-12 text-fg-muted">{t("keyboard")}</p>
    </section>
  );
}
