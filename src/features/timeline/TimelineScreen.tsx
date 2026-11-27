"use client";

import { Minus, Plus } from "lucide-react";
import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PeriodTheme } from "@/components/layout/PeriodTheme";
import type { Locale } from "@/domain/schema";
import { RulerPanel } from "@/features/ruler-panel/RulerPanel";
import { easeInOutCubic } from "@/features/simulation-shell/map/SvgMap";
import { Link, useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/client";
import { cx } from "@/lib/cx";
import { formatYear, formatYearOrdinal } from "@/lib/historicalDate";
import { deviceLooksWeak, useSettings } from "@/lib/settings";
import { createTimeScale } from "@/lib/timeScale";
import { snapshotForYear } from "@/lib/timeSlider";
import type { ZamanData, ZamanEvent } from "./data";
import { TimeAxis } from "./TimeAxis";
import type { TimelineMapHandle } from "./TimelineMap";

/** MapLibre loads only with the timeline (§11). */
const TimelineMap = dynamic(() => import("./TimelineMap").then((m) => m.TimelineMap), { ssr: false });

const LAYERS = ["borders", "capitals", "events", "legends"] as const;
type Layer = (typeof LAYERS)[number];
const DEFAULT_LAYERS: Layer[] = ["borders", "capitals", "events"];
/** The map follows the slider once it rests this long (§6.2: ≈120 ms). */
const MAP_DEBOUNCE_MS = 120;
/** The period theme changes a little later still, so a fast drag does not flash colours. */
const THEME_DEBOUNCE_MS = 320;
const ZOOM_MS = 450;

const noop = () => () => {};
const webglAvailable = () => {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
};
let glSupport: boolean | null = null;
const glOnce = () => (glSupport ??= webglAvailable());

function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/** The shown range of the axis, animated toward its target (instant with reduced motion). */
function useAnimatedView(target: [number, number], reduced: boolean): [number, number] {
  const [view, setView] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (reduced || (from[0] === target[0] && from[1] === target[1])) {
      current.current = target;
      const id = requestAnimationFrame(() => setView(target));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const k = easeInOutCubic(Math.min(1, (now - t0) / ZOOM_MS));
      const next: [number, number] = [Math.round(from[0] + (target[0] - from[0]) * k), Math.round(from[1] + (target[1] - from[1]) * k)];
      current.current = next;
      setView(next);
      if (k < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return view;
}

function writeQuery(patch: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  window.history.replaceState(null, "", url);
}

/**
 * Zaman şkalası (FRONTEND_SPEC §6.2, artboard "Zaman şkalası + hökmdar
 * paneli"): the political map of the chosen year with capitals and events,
 * the year and its era, map layers, the ruler panel for a clicked state, and
 * the weighted time axis with its lanes. The year and the layers live in the
 * address (?year=&layers=), so a year can be shared.
 */
export function TimelineScreen({ data }: { data: ZamanData }) {
  const t = useTranslations("zaman");
  const locale = useLocale() as Locale;
  const params = useSearchParams();
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const settings = useSettings();
  const lite = settings.lightMode ?? deviceLooksWeak();
  const gl = useSyncExternalStore(noop, glOnce, () => null);
  const [mapFailed, setMapFailed] = useState(false);
  const map = useRef<TimelineMapHandle>(null);

  const [year, setYear] = useState(() => {
    const y = Number(params.get("year"));
    return Number.isInteger(y) && y !== 0 && y >= data.from && y <= data.to ? y : data.defaultYear;
  });
  const [layers, setLayers] = useState<Layer[]>(() => {
    const raw = params.get("layers");
    if (raw === null) return DEFAULT_LAYERS;
    return raw.split(",").filter((l): l is Layer => (LAYERS as readonly string[]).includes(l));
  });
  const [zoomedEra, setZoomedEra] = useState<string | null>(null);
  const [polityId, setPolityId] = useState<string | null>(null);

  const settled = useSettled(year, MAP_DEBOUNCE_MS);
  const themeYear = useSettled(year, THEME_DEBOUNCE_MS);
  const full = useMemo<[number, number]>(() => [data.from, data.to], [data.from, data.to]);
  const zoomTarget = useMemo<[number, number]>(() => {
    const era = zoomedEra ? data.eras.find((e) => e.id === zoomedEra) : undefined;
    return era ? [Math.max(era.from, data.from), Math.min(era.to, data.to)] : full;
  }, [zoomedEra, data.eras, data.from, data.to, full]);
  const view = useAnimatedView(zoomTarget, reduced);
  const scale = useMemo(() => createTimeScale(data.segments, view), [data.segments, view]);

  const eraOf = (y: number) => [...data.eras].filter((e) => e.from <= y && y <= e.to).sort((a, b) => b.from - a.from)[0] ?? null;
  const era = eraOf(year);
  const themeEra = eraOf(themeYear);
  const mapEra = eraOf(settled);
  const pick = snapshotForYear(settled, data.snapshots);
  const snapshot = pick.covered ? (data.snapshots.find((s) => s.id === pick.id) ?? null) : null;
  const capitalIds = useMemo(() => snapshot?.polities.flatMap((p) => (p.capitalId ? [p.capitalId] : [])) ?? [], [snapshot]);
  const on = (l: Layer) => layers.includes(l);
  const alive = data.persons.filter((p) => p.from <= year && year <= p.to);
  const yearEvents = useMemo(
    () => data.events.filter((e) => e.year === settled && (!e.legend || layers.includes("legends"))),
    [data.events, settled, layers],
  );

  // The year and the layers in the address (no navigation, Next keeps useSearchParams in sync).
  useEffect(() => {
    writeQuery({ year: String(settled), layers: layers.join(",") === DEFAULT_LAYERS.join(",") ? null : layers.join(",") });
  }, [settled, layers]);
  // A learning event once the slider has rested on a year for a moment, not for every pixel of a drag.
  const rested = useSettled(year, 1500);
  const [openedOn] = useState(year);
  useEffect(() => {
    if (rested !== openedOn) track({ type: "time_slider_used", year: rested });
  }, [rested, openedOn]);

  const toggle = (l: Layer) => setLayers((ls) => (ls.includes(l) ? ls.filter((x) => x !== l) : [...ls, l]));
  const goEvent = (e: ZamanEvent) => router.push(e.href);
  const showMap = gl && !mapFailed;

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-var(--header-h,101px))] lg:min-h-[760px]" data-testid="timeline-screen" data-year={year}>
      <PeriodTheme id={themeEra?.themeId ?? null} />
      <div className="relative h-[52vh] min-h-[320px] overflow-hidden bg-surface lg:h-auto lg:flex-1" data-testid="timeline-map" data-snapshot={snapshot?.id ?? "none"}>
        {gl === null ? null : showMap ? (
          <TimelineMap
            ref={map}
            locale={locale}
            snapshotId={snapshot?.id ?? null}
            variant={mapEra?.mapVariant ?? "manuscript"}
            year={settled}
            capitals={data.capitals}
            capitalIds={capitalIds}
            events={on("events") ? yearEvents : []}
            layers={{ borders: on("borders"), capitals: on("capitals"), events: on("events") }}
            lite={lite}
            reduced={reduced}
            onPolity={setPolityId}
            onEvent={goEvent}
            onFail={() => setMapFailed(true)}
          />
        ) : (
          <p className="absolute inset-0 m-0 grid place-items-center p-8 text-center text-15 text-fg-secondary" data-testid="no-map">
            {t("noMap")}
          </p>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 75% 70% at 45% 50%, transparent 55%, color-mix(in srgb, var(--bg-base) 92%, transparent) 100%)" }} />

        {/* Year, era and layers */}
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-3 sm:left-7 sm:top-6">
          <div className="flex items-baseline gap-3.5 rounded-[18px] border border-line-strong bg-surface/85 px-5 py-3.5 backdrop-blur-sm" aria-live="polite">
            <span className="font-heading text-44 font-medium leading-none text-accent sm:text-60" data-testid="timeline-year">
              {formatYear(year)}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-13 text-fg-muted">{t("era")}</span>
              <span className="text-16 font-semibold text-fg" data-testid="timeline-era">
                {era?.name ?? t("noEra")}
              </span>
            </span>
          </div>
          {alive.length ? (
            <ul className="m-0 flex max-w-[min(420px,calc(100vw-1.5rem))] list-none flex-wrap gap-1.5 p-0" aria-label={t("alive")} data-testid="timeline-persons">
              {alive.map((p) => (
                <li key={p.id}>
                  <Link
                    href={p.href}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full border bg-surface/85 px-3 text-13 text-fg backdrop-blur-sm hover:bg-surface"
                    style={{ borderColor: p.color }}
                  >
                    {p.name} · {t("age", { age: year - p.from, approx: p.approximate ? "~" : "" })}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <fieldset className="m-0 hidden flex-col gap-1.5 self-start rounded-panel border border-fg/12 bg-surface/85 p-3.5 text-14 backdrop-blur-sm sm:flex" data-testid="layers">
            <legend className="sr-only">{t("layersLabel")}</legend>
            {LAYERS.map((l) => (
              <label key={l} className="flex min-h-8 cursor-pointer items-center gap-2.5 text-fg">
                <input type="checkbox" checked={on(l)} onChange={() => toggle(l)} className="size-4 accent-[var(--accent)]" />
                {t(`layer.${l}`)}
              </label>
            ))}
          </fieldset>
        </div>

        {/* No map covers the year: say so, offer the nearest maps. */}
        {!pick.covered && on("borders") ? (
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border border-line bg-surface/90 px-4 py-2 text-13 text-fg-secondary backdrop-blur-sm" data-testid="map-gap">
            {t("mapGap", { year: formatYear(settled) })}
            {pick.prevYear !== null ? (
              <button type="button" onClick={() => setYear(pick.prevYear!)} className="font-semibold text-accent hover:underline">
                ← {formatYear(pick.prevYear)}
              </button>
            ) : null}
            {pick.nextYear !== null ? (
              <button type="button" onClick={() => setYear(pick.nextYear!)} className="font-semibold text-accent hover:underline">
                {formatYear(pick.nextYear)} →
              </button>
            ) : null}
          </div>
        ) : null}

        {polityId ? (
          <div className="absolute inset-x-3 bottom-3 z-20 max-h-[calc(100%-1.5rem)] sm:inset-x-auto sm:bottom-auto sm:right-7 sm:top-6 sm:w-[360px]">
            <RulerPanel
              political={data.political}
              polityId={polityId}
              year={settled}
              snapshot={snapshot}
              onClose={() => setPolityId(null)}
              className="max-h-[calc(52vh-1.5rem)] sm:max-h-[calc(100dvh-var(--header-h,101px)-420px)] lg:max-h-[calc(100dvh-var(--header-h,101px)-460px)]"
            />
          </div>
        ) : null}

        {showMap ? (
          <div className={cx("absolute bottom-6 right-3 z-10 flex flex-col gap-1.5 sm:right-7", polityId && "max-sm:hidden sm:right-[412px]")}>
            <button type="button" onClick={() => map.current?.zoomIn()} aria-label={t("zoomIn")} className="inline-flex size-11 items-center justify-center rounded-button border border-fg/20 bg-surface/85 text-fg backdrop-blur-sm hover:bg-surface">
              <Plus size={18} aria-hidden />
            </button>
            <button type="button" onClick={() => map.current?.zoomOut()} aria-label={t("zoomOut")} className="inline-flex size-11 items-center justify-center rounded-button border border-fg/20 bg-surface/85 text-fg backdrop-blur-sm hover:bg-surface">
              <Minus size={18} aria-hidden />
            </button>
          </div>
        ) : null}
        <span className="sr-only">{t("mapLabel", { year: formatYearOrdinal(settled) })}</span>
      </div>

      <TimeAxis
        data={data}
        scale={scale}
        year={year}
        eraName={era?.name ?? null}
        zoomedEra={zoomedEra}
        onYear={(y) => setYear(y)}
        onZoom={(id) => {
          setZoomedEra(id);
          const e = id ? data.eras.find((x) => x.id === id) : undefined;
          if (e && (year < e.from || year > e.to)) setYear(e.from);
        }}
        onPolity={setPolityId}
      />
    </div>
  );
}
