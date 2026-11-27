"use client";

import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BottomSheet, sheetHeight } from "@/components/ui/BottomSheet";
import { Compass } from "@/components/icons";
import { LiveRegion } from "@/components/ui/LiveRegion";
import { Panel } from "@/components/ui/Panel";
import { ProgressSegments } from "@/components/ui/Progress";
import { pathOf, peekReturn, popReturn, pushReturn } from "@/features/engine/navStack";
import { useStoredMode } from "@/features/simulation/useStoredMode";
import { flushAnalytics, ownerOf, track } from "@/lib/analytics/client";
import { cx } from "@/lib/cx";
import { progressStore, saveProgress, useProgress } from "@/lib/progress";
import { Link, useRouter } from "@/i18n/navigation";
import { deviceLooksWeak, updateSettings, useSettings } from "@/lib/settings";
import { useMediaQuery, useViewportHeight } from "@/lib/useMediaQuery";
import { useSimulationStore } from "@/stores/simulation";
import { stampPlaces } from "@/stores/passport";
import { useThemeStore } from "@/stores/theme";
import { planTransition, runTransition, type TransitionActors } from "./choreography";
import { useAutoplay, useShellKeys, useSwipe } from "./hooks";
import { ShellMap } from "./map/ShellMap";
import { RulerPanel } from "@/features/ruler-panel/RulerPanel";
import { PlaceCard } from "./parts/PlaceCard";
import { PortraitCard } from "./parts/PortraitCard";
import { ShellTimeline } from "./parts/ShellTimeline";
import { StepContent } from "./parts/StepContent";
import { StepNav } from "./parts/StepNav";
import { TopBar, type ShellMode } from "./parts/TopBar";
import type { MapController, ShellData } from "./types";
import { useShellAudio } from "./useShellAudio";

/** Desktop story panel width plus its margins: the map centres its target in the rest. */
const PANEL_SPACE = 468;
const AUTOPLAY_DWELL_MS = 7000;

const noopSubscribe = () => () => {};

const noopMap: MapController = { showStep: () => {}, flyTo: () => Promise.resolve(), drawRoute: () => Promise.resolve() };

/** Writes query parameters into the address without a navigation (Next syncs useSearchParams). */
function writeQuery(patch: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  window.history.replaceState(null, "", url);
}

/**
 * The simulation engine of the new design (§5): map stage, story panel
 * (bottom sheet on phones), timeline, top bar. Every step change runs the
 * §5.3 choreography; the step, mode and legend filter live in the URL.
 */
export function SimulationShell({ data }: { data: ShellData }) {
  const t = useTranslations("shell");
  const params = useSearchParams();
  const reduced = useReducedMotion() ?? false;
  const desktop = useMediaQuery("(min-width: 1024px)", true);
  const vh = useViewportHeight();
  const settings = useSettings();
  const lite = settings.lightMode ?? deviceLooksWeak();
  const locale = useLocale() as import("@/domain/schema").Locale;
  const [storedMode, setStoredMode] = useStoredMode();

  const modeParam = params.get("mode");
  const mode: ShellMode = modeParam === "learn" || modeParam === "story" ? modeParam : storedMode;
  const legendsParam = params.get("legends");
  const legends = legendsParam === "0" ? false : legendsParam === "1" ? true : settings.showLegends;
  const hasLegends = data.steps.some((s) => s.claimType === "legend");
  const visible = useMemo(() => (legends ? data.steps : data.steps.filter((s) => s.claimType !== "legend")), [data.steps, legends]);

  const { index, contentIndex, leaving, started, counterIndex, stagger, readyKey, playing, panelOpen, sheet, announcement, set } = useSimulationStore();
  const map = useRef<MapController>(null);
  const mapArea = useRef<HTMLDivElement>(null);
  const previous = useRef<number | null>(null);
  const running = useRef<AbortController | null>(null);
  const owner = useMemo(() => ownerOf(data.kind === "person" ? `person:${data.key}` : data.key), [data.kind, data.key]);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [polityId, setPolityId] = useState<string | null>(null);
  const rt = useTranslations("rulerPanel");
  const router = useRouter();
  const pathname = usePathname();
  // Arrived through a cross-link from another simulation: offer the way back (tarix:navstack, per tab).
  const returnLabel = useSyncExternalStore(
    noopSubscribe,
    () => peekReturn(pathOf(pathname))?.label ?? "",
    () => "",
  );
  const goBack = () => {
    const entry = popReturn();
    if (entry) router.push(entry.href);
  };
  const place = placeId ? (data.landmarks.find((l) => l.id === placeId) ?? null) : null;

  // First step: ?step= (a shared link), else where the viewer left off ("Davam et · 7/14"), else the beginning.
  // The shell renders in the browser only (useSearchParams), so saved progress can be read here.
  const initial = useMemo(() => {
    const requested = data.steps.find((s) => s.id === params.get("step"));
    if (requested) return requested.index;
    const saved = progressStore.get().persons[data.key];
    if (saved && !saved.completed && saved.index > 0 && data.steps[saved.index]) return saved.index;
    return visible[0]?.index ?? 0;
    // Only on mount: later changes come from the viewer, not the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    useSimulationStore.getState().reset(initial);
    track({ type: "simulation_started", ...owner, mode });
    return () => {
      running.current?.abort();
      useSimulationStore.getState().set({ started: false });
      useThemeStore.getState().setOverride(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = Math.max(0, visible.findIndex((s) => s.index === index));
  const step = data.steps[index] ?? data.steps[0]!;
  const prev = visible[pos - 1] ?? null;
  const next = visible[pos + 1] ?? null;

  const go = useCallback((target: number | undefined) => {
    if (target === undefined) return;
    setPlaceId(null);
    setPolityId(null);
    set({ index: target });
  }, [set]);
  const goNext = useCallback(() => go(next?.index), [go, next]);
  const goPrev = useCallback(() => go(prev?.index), [go, prev]);

  // The choreography of every step change (§5.3); a new change aborts the running one.
  useEffect(() => {
    const to = data.steps[index];
    if (!to || !started) return;
    running.current?.abort();
    const ctrl = new AbortController();
    running.current = ctrl;
    const from = previous.current === null ? null : (data.steps[previous.current] ?? null);
    previous.current = index;
    const plan = planTransition(from, to, { reduced });
    const total = visible.length;
    const position = Math.max(0, visible.findIndex((s) => s.index === to.index));
    const actors: TransitionActors = {
      map: map.current ?? noopMap,
      panelOut: () => set({ leaving: true, readyKey: null }),
      setTheme: (id) => useThemeStore.getState().setOverride(id),
      counters: () => set({ counterIndex: to.index }),
      portrait: () => {},
      contentIn: (s) =>
        set({ contentIndex: to.index, leaving: false, stagger: s, announcement: t("announce", { current: position + 1, total, title: to.title, date: to.dateLabel }) }),
    };
    void runTransition(plan, to, actors, ctrl.signal).then(() => {
      if (!ctrl.signal.aborted) set({ readyKey: to.id });
    });
    writeQuery({ step: to.id });
    if (to.stampId) stampPlaces([to.stampId], data.key);
    track({ type: "step_viewed", ...owner, stepKey: to.id });
    const saved = progressStore.get().persons[data.key];
    saveProgress(data.key, { index: to.index, phase: "journey", choices: saved?.choices ?? {} }, data.steps.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, started]);

  // Leaving before the last step is a learning signal (anonymous, ADR-0020); from the last step it is finishing.
  const whereNow = useRef({ stepKey: step.id, atEnd: !next });
  useEffect(() => {
    whereNow.current = { stepKey: step.id, atEnd: !next };
  });
  useEffect(() => {
    let left = false;
    const leave = () => {
      if (left || whereNow.current.atEnd) return;
      left = true;
      track({ type: "simulation_abandoned", ...owner, stepKey: whereNow.current.stepKey });
      flushAnalytics();
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [owner]);

  useShellAudio(step, next, settings);

  // A hidden legend step is left for the nearest visible one.
  useEffect(() => {
    if (!legends && data.steps[index]?.claimType === "legend") {
      const target = (visible.find((s) => s.index > index) ?? visible.at(-1))?.index;
      if (target !== undefined) set({ index: target });
    }
  }, [legends, index, data.steps, visible, set]);

  const choices = useProgress().persons[data.key]?.choices ?? {};
  const pick = (stepId: string, i: number) => {
    const saved = progressStore.get().persons[data.key];
    saveProgress(data.key, { index, phase: "journey", choices: { ...(saved?.choices ?? {}), [stepId]: i } }, data.steps.length);
    track({ type: "choice_made", ...owner, stepKey: stepId, optionIndex: i });
  };

  const setMode = (m: ShellMode) => {
    if (m !== mode) track({ type: "mode_switched", ...owner, mode: m });
    setStoredMode(m);
    writeQuery({ mode: m });
  };
  const toggleLegends = () => {
    updateSettings({ showLegends: !legends });
    writeQuery({ legends: legends ? "0" : "1" });
  };
  const toggleMute = () => updateSettings({ muted: !settings.muted });
  const togglePlay = () => set({ playing: !playing });

  useShellKeys({
    onPrev: goPrev,
    onNext: goNext,
    onToggleAutoplay: togglePlay,
    onEscape: () => (desktop ? set({ panelOpen: !panelOpen }) : set({ sheet: "peek" })),
    onMute: toggleMute,
  });
  useSwipe(mapArea, { onLeft: goNext, onRight: goPrev });
  useAutoplay(playing, readyKey, AUTOPLAY_DWELL_MS, () => (next ? goNext() : set({ playing: false })));

  // How a clicked state relates to the step on screen.
  const polityNotes = (s: ShellData["steps"][number], id: string): string[] => {
    const out: string[] = [];
    const reigning = data.political.reigns.filter((r) => r.polityId === id && r.from <= s.year && s.year <= r.to);
    const selfHref = data.kind === "person" ? `/sexsiyyetler/${data.key}/` : null;
    if (selfHref && reigning.some((r) => data.political.rulers[r.rulerId]?.personHref === selfHref)) out.push(rt("youRule"));
    if (s.battle?.ownPolityId === id) out.push(rt("ownSide", { side: s.battle.own }));
    if (s.battle?.enemyPolityId === id) out.push(rt("enemySide", { side: s.battle.enemy }));
    return out;
  };

  const shown = contentIndex === null ? null : data.steps[contentIndex];
  const counterStep = data.steps[counterIndex] ?? step;
  const content = shown ? (
    // A new step remounts (key) and staggers in; the old one fades out with `leaving` and is simply
    // replaced. No exit animation to wait for, so a slow frame can never leave the panel empty or doubled.
    <StepContent
      key={shown.id}
      step={shown}
      leaving={leaving}
      total={visible.length}
      position={Math.max(0, visible.findIndex((s) => s.index === shown.index))}
      mode={mode}
      stagger={stagger}
      picked={choices[shown.id]}
      onPick={(i) => pick(shown.id, i)}
      legends={legends}
      onPlace={setPlaceId}
      onFollow={(href) => pushReturn({ href: `${pathOf(pathname)}?step=${shown.id}`, label: `${data.title} · ${shown.title}`, target: pathOf(href) })}
      compact={!desktop}
    />
  ) : null;
  const nav = <StepNav prev={prev} next={next} final={data.final} onPrev={goPrev} onNext={goNext} compact={!desktop} />;
  const padding = useMemo(
    () => (desktop ? { right: panelOpen ? PANEL_SPACE : 0, bottom: 0 } : { right: 0, bottom: sheetHeight(sheet, vh) }),
    [desktop, panelOpen, sheet, vh],
  );

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden" data-testid="simulation-shell" data-step={step.id} data-mode={mode}>
      <LiveRegion message={announcement} />
      {desktop ? (
        <TopBar
          title={data.title}
          subtitle={data.subtitle}
          back={data.back}
          mode={mode}
          onMode={setMode}
          legends={legends}
          onLegends={toggleLegends}
          hasLegends={hasLegends}
          muted={settings.muted}
          onMute={toggleMute}
          playing={playing}
          onPlay={togglePlay}
        />
      ) : null}

      <div ref={mapArea} className="relative min-h-0 flex-1" data-testid="map-stage">
        <ShellMap
          ref={map}
          data={data}
          locale={locale}
          padding={padding}
          lite={lite}
          reduced={reduced}
          onPlace={(id) => {
            setPolityId(null);
            setPlaceId(id);
          }}
          onPolity={(id) => {
            setPlaceId(null);
            setPolityId(id);
          }}
        />

        {!desktop ? (
          <MobileBar data={data} step={counterStep} muted={settings.muted} onMute={toggleMute} />
        ) : null}

        {desktop && (counterStep.age || counterStep.portrait) ? (
          <div className="absolute left-7 top-7 z-10">
            <PortraitCard step={counterStep} crossfadeMs={reduced ? 0 : 500} />
          </div>
        ) : null}

        {polityId ? (
          <div className={cx("absolute z-20", desktop ? "bottom-28 left-7 top-7 flex w-[360px] items-start" : "inset-x-3 top-[72px] max-h-[calc(100%-90px)]")}>
            <RulerPanel
              political={data.political}
              polityId={polityId}
              year={counterStep.year}
              snapshot={data.snapshots.find((sn) => sn.id === counterStep.snapshotId) ?? null}
              notes={polityNotes(counterStep, polityId)}
              currentPersonHref={data.kind === "person" ? `/sexsiyyetler/${data.key}/` : null}
              onClose={() => setPolityId(null)}
              className="max-h-full w-full"
            />
          </div>
        ) : null}

        {returnLabel ? (
          <button
            type="button"
            onClick={goBack}
            className={cx(
              "absolute z-20 max-w-[min(26rem,calc(100%-2rem))] truncate rounded-full border border-line-strong bg-surface-panel/90 px-4 py-2 text-left text-13 font-medium text-fg shadow-deep backdrop-blur-sm hover:text-accent",
              desktop ? "left-1/2 top-4 -translate-x-1/2" : "left-3 top-[68px]",
            )}
            data-testid="return-link"
          >
            ← {returnLabel}
          </button>
        ) : null}

        {place ? (
          <div className={cx("absolute z-20", desktop ? "bottom-28 left-7 w-[360px]" : "inset-x-3 top-[72px]")}>
            <PlaceCard
              place={place}
              year={counterStep.year}
              capital={!!counterStep.snapshotId && (data.capitals[counterStep.snapshotId] ?? []).includes(place.id)}
              steps={visible}
              onGoto={go}
              onClose={() => setPlaceId(null)}
            />
          </div>
        ) : null}

        <div className={cx("pointer-events-none absolute left-7 z-10 flex items-end gap-4", desktop ? "bottom-12" : "hidden")}>
          <Compass size={56} title={t("compass")} className="text-map-ink" />
          <span className="rounded-full bg-map-parchment-center/80 px-3 py-1 text-12 text-map-ink" data-testid="map-note">
            {t("mapNote")}
          </span>
        </div>

        {desktop ? (
          panelOpen ? (
            <Panel edge position="absolute" className="bottom-6 right-6 top-6 z-10 flex w-[420px] flex-col" data-testid="story-panel">
              <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6 pt-8">
                {content}
              </div>
              <div className="shrink-0 border-t border-line p-5">{nav}</div>
            </Panel>
          ) : (
            <button
              type="button"
              onClick={() => set({ panelOpen: true })}
              className="absolute right-6 top-6 z-10 rounded-full bg-accent px-5 py-3 text-14 font-semibold text-accent-ink shadow-deep"
            >
              {t("panelShow")}
            </button>
          )
        ) : null}
      </div>

      {desktop ? (
        <ShellTimeline steps={visible} current={index} onSelect={go} />
      ) : (
        <BottomSheet
          snap={sheet}
          onSnap={(s) => set({ sheet: s })}
          vh={vh}
          label={data.title}
          expandLabel={t("sheet.expand")}
          collapseLabel={t("sheet.collapse")}
          footer={
            <div className="flex flex-col gap-3">
              <ProgressSegments total={visible.length} done={pos} current={pos} />
              {nav}
            </div>
          }
        >
          {content}
        </BottomSheet>
      )}
    </div>
  );
}

/** Phone top bar over the map (Mobile artboard): back, year and age, sound. */
function MobileBar({ data, step, muted, onMute }: { data: ShellData; step: ShellData["steps"][number]; muted: boolean; onMute: () => void }) {
  const t = useTranslations("shell");
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-4" data-testid="mobile-bar">
      <h1 className="sr-only">{data.title}</h1>
      <Link
        href={data.back.href}
        aria-label={t("back", { label: data.back.label })}
        className="inline-flex size-11 items-center justify-center rounded-button bg-surface/80 text-fg backdrop-blur-sm"
      >
        <ArrowLeft size={18} aria-hidden />
      </Link>
      <span className="rounded-full bg-surface/80 px-4 py-2 text-15 text-fg backdrop-blur-sm" data-testid="mobile-year">
        <span className="font-heading text-19 font-semibold text-accent">{step.year}</span>
        {step.age ? (
          <span className="text-fg-secondary">
            {" "}
            · {step.age.approximate ? "~" : ""}
            {step.age.years} {t("age")}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={onMute}
        aria-label={muted ? t("soundOn") : t("soundOff")}
        aria-pressed={!muted}
        className="inline-flex size-11 items-center justify-center rounded-button bg-surface/80 text-fg backdrop-blur-sm"
      >
        {muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
      </button>
    </div>
  );
}
