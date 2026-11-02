"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import type { Locale, Maneuver, Mood } from "@/domain/schema";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { GlossaryProvider } from "@/components/GlossaryText";
import { getAudioEngine } from "@/features/audio/engine";
import { MapLegend } from "@/features/map/MapLegend";
import { MapStage, type Phase } from "@/features/map/MapStage";
import { PlaceCard } from "@/features/map/PlaceCard";
import { PolityPanel } from "@/features/map/PolityPanel";
import { DEFAULT_ENEMY_COLOR, DEFAULT_OWN_COLOR } from "@/features/map/style";
import { SettingsButton } from "@/features/settings/SettingsPanel";
import { useStoredMode, type Mode } from "@/features/simulation/useStoredMode";
import { format, t, type Messages } from "@/lib/i18n";
import { MOOD_STYLES } from "@/lib/mood";
import { clearProgress, progressStore, saveProgress, useProgress } from "@/lib/progress";
import { deviceLooksWeak, useSettings } from "@/lib/settings";
import { useMediaQuery, useViewportHeight } from "@/lib/useMediaQuery";
import type { ResolvedRef } from "@/domain/registry";
import { pathOf, peekReturn, popReturn, pushReturn } from "./navStack";
import { GateController, StartGate, type StartChoice } from "./StartGate";
import { Timeline } from "./Timeline";
import type { Counter, EngineStep, SimulationData } from "./types";

export interface StepContext<S extends EngineStep> {
  step: S;
  index: number;
  mode: Mode;
  choices: Record<string, number>;
  choose: (option: number) => void;
  /** Return target for cross-links leaving this step. */
  here: { href: string; label: string };
  openPlace: (placeId: string) => void;
  teacher: boolean;
}

export interface FinalContext {
  choices: Record<string, number>;
  teacher: boolean;
  restart: () => void;
  back: () => void;
}

interface Props<S extends EngineStep> {
  data: SimulationData<S>;
  locale: Locale;
  messages: Messages;
  /** HUD numbers: year + age, war day, etc. */
  counters: (step: S, final: boolean) => Counter[];
  renderStep: (ctx: StepContext<S>) => React.ReactNode;
  renderFinal: (ctx: FinalContext) => React.ReactNode;
  /** Label of the "next" button on the last step, e.g. "İrs və nəticə". */
  finalLabel: string;
  /** Footer label while the final panel is open. */
  finalTitle: string;
  finalMood?: Mood;
  /** Story / learning mode toggle. */
  modes?: boolean;
  /** SFX when a step opens. */
  stepSfx?: (step: S) => "drum" | "whoosh";
  /** Category list this simulation belongs to, for the HUD back link. */
  indexLink: { href: string; label: string };
  /** Extra strip under the timeline, e.g. the dynasty of a state. */
  belowTimeline?: (step: S, final: boolean) => React.ReactNode;
}

const noop = () => () => {};
const useWeakDevice = () => useSyncExternalStore(noop, deviceLooksWeak, () => false);

/**
 * Shared simulation shell: map, timeline, mood grading and sound, start gate,
 * progress, deep links and cross-link return. What a step *is* (life event,
 * war day, state stage) is decided by `renderStep` and `counters`.
 */
export function SimulationEngine<S extends EngineStep>({
  data,
  locale,
  messages: m,
  counters,
  renderStep,
  renderFinal,
  finalLabel,
  finalTitle,
  finalMood = "peace",
  modes = true,
  stepSfx = (s) => (s.battle ? "drum" : "whoosh"),
  indexLink,
  belowTimeline,
}: Props<S>) {
  const { steps, places, eras } = data;
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("journey");
  const [dir, setDir] = useState(1);
  const [mode, setMode] = useStoredMode();
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [placeId, setPlaceIdRaw] = useState<string | null>(null);
  const [polityId, setPolityIdRaw] = useState<string | null>(null);
  // One card at a time: a place or a state.
  const setPlaceId = useCallback((id: string | null) => {
    setPolityIdRaw(null);
    setPlaceIdRaw(id);
  }, []);
  const setPolityId = useCallback((id: string | null) => {
    setPlaceIdRaw(null);
    setPolityIdRaw(id);
  }, []);
  const settings = useSettings();
  const weak = useWeakDevice();
  const light = settings.lightMode ?? weak;
  const teacher = settings.teacherMode;
  const systemReduced = useReducedMotion() ?? false;
  const reduced = systemReduced || light;
  const desktop = useMediaQuery("(min-width: 1024px)", true);
  const vh = useViewportHeight();
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const step = steps[index]!;
  const last = steps.length - 1;
  const title = t(data.title, locale);
  const panelW = teacher ? 560 : 430;
  const final = phase === "legacy";
  const shownStep = final ? steps[last]! : step;
  const mood = final ? finalMood : step.mood;
  const moodStyle = MOOD_STYLES[mood];

  // ---- where to start: saved progress (the deep link is read in GateController) ----
  const saved = useProgress().persons[data.key];
  const resume = useMemo(() => {
    if (!saved || (saved.index === 0 && saved.phase !== "legacy")) return null;
    const i = Math.min(saved.index, last);
    return { index: i, title: t(steps[i]!.title, locale) };
  }, [saved, steps, last, locale]);

  const engine = getAudioEngine();
  const start = useCallback(
    (choice: StartChoice) => {
      const savedNow = progressStore.get().persons[data.key];
      if (choice.kind === "resume" && savedNow) {
        setChoices(savedNow.choices);
        setIndex(Math.min(choice.index, last));
        if (savedNow.phase === "legacy") setPhase("legacy");
      } else if (choice.kind === "jump") {
        setIndex(choice.index);
        setPhase("journey");
      } else {
        clearProgress(data.key);
        setIndex(0);
        setPhase("journey");
      }
      setStarted(true);
      void engine.start(settings, choice.kind === "begin" ? steps[0]!.mood : steps[choice.index]!.mood);
    },
    [data.key, last, steps, engine, settings],
  );

  // ---- persistence --------------------------------------------------------------
  useEffect(() => {
    if (!started) return;
    saveProgress(data.key, { index, phase, choices }, steps.length);
  }, [started, data.key, index, phase, choices, steps.length]);

  // ---- audio: mood, settings, effects -------------------------------------------
  useEffect(() => engine.applySettings(settings), [engine, settings]);
  useEffect(() => {
    if (!started) return;
    engine.setMood(mood);
    const upcoming = steps[index + 1]?.mood;
    if (upcoming && upcoming !== mood) void engine.preload(upcoming);
  }, [engine, started, mood, index, steps]);
  const firstStep = useRef(true);
  useEffect(() => {
    if (!started) return;
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    engine.playSfx(final ? "chime" : stepSfx(step));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, started, index, phase]);
  const onBattleArrow = useCallback(
    (mv: Maneuver, artillery: boolean) => {
      if (mv.kind === "retreat") return;
      engine.playSfx(artillery && mv.side === "enemy" ? "cannon" : mv.side === "own" ? "sword" : "drum");
    },
    [engine],
  );

  // ---- navigation -----------------------------------------------------------------
  const go = useCallback(
    (target: number) => {
      setPlaceId(null);
      if (phase === "legacy") {
        setPhase("journey");
        setDir(target >= index ? 1 : -1);
        setIndex(Math.max(0, Math.min(last, target)));
        return;
      }
      if (target > last) {
        setDir(1);
        setPhase("legacy");
        return;
      }
      if (target < 0 || target === index) return;
      setDir(target > index ? 1 : -1);
      setIndex(target);
    },
    [index, last, phase, setPlaceId],
  );
  const next = useCallback(() => (phase === "legacy" ? undefined : go(index + 1)), [go, index, phase]);
  const prev = useCallback(() => (phase === "legacy" ? go(last) : go(index - 1)), [go, index, last, phase]);

  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Presentation clickers send PageDown/PageUp.
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, next, prev]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [index, phase]);

  // Teacher mode enlarges the whole UI (rem-based) for projectors.
  useEffect(() => {
    document.documentElement.classList.toggle("teacher-mode", teacher);
    return () => document.documentElement.classList.remove("teacher-mode");
  }, [teacher]);

  // ---- return path from a cross-link ---------------------------------------------
  const returnLabel = useSyncExternalStore(
    noop,
    () => peekReturn(pathOf(pathname))?.label ?? "",
    () => "",
  );
  const followHref = (href: string) => {
    pushReturn({ href: here.href, label: here.label, target: pathOf(href) });
    router.push(`/${locale}${href}`);
  };
  const goBackToSource = () => {
    const entry = popReturn();
    if (entry) router.push(`/${locale}${entry.href}`);
  };

  // Mobile bottom sheet geometry.
  const sheetH = Math.round(vh * 0.88);
  const peekH = Math.round(Math.max(vh * 0.44, 300));
  const collapsedY = Math.max(sheetH - peekH, 0);

  const padding = useMemo(
    () =>
      desktop
        ? { top: 96, right: panelW + 48, bottom: 150, left: 340 }
        : { top: 84, right: 28, bottom: peekH + 16, left: 28 },
    [desktop, peekH, panelW],
  );

  const restart = () => {
    clearProgress(data.key);
    setChoices({});
    setPhase("journey");
    setDir(-1);
    setIndex(0);
  };

  const snapshot = data.snapshots.find((s) => s.id === shownStep.snapshotId) ?? null;
  const battle = final ? null : step.battle;
  const battleLegend = battle?.maneuvers?.length
    ? {
        own: (battle.ownPolityId && data.polityColors[battle.ownPolityId]) || DEFAULT_OWN_COLOR,
        enemy: (battle.enemyPolityId && data.polityColors[battle.enemyPolityId]) || DEFAULT_ENEMY_COLOR,
        ownName: t(battle.ownSide, locale),
        enemyName: t(battle.enemySide, locale),
      }
    : null;
  const selectedPlace = placeId ? data.landmarks.find((p) => p.id === placeId) : undefined;
  const here = {
    href: `${data.path}?step=${step.id}`,
    label: `${title} · ${t(step.title, locale)} (${step.year})`,
  };

  const panelBody = (
    <AnimatePresence mode="wait" initial={false} custom={dir}>
      <motion.div
        key={final ? "legacy" : step.id}
        custom={dir}
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir * 28 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -28 }}
        transition={{ duration: reduced ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {final
          ? renderFinal({ choices, teacher, restart, back: () => go(last) })
          : renderStep({
              step,
              index,
              mode,
              choices,
              teacher,
              here,
              openPlace: setPlaceId,
              choose: (i) => {
                engine.playSfx("page");
                setChoices((c) => ({ ...c, [step.id]: i }));
              },
            })}
      </motion.div>
    </AnimatePresence>
  );

  const navButtons = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={prev}
        disabled={phase === "journey" && index === 0}
        className="rounded-full border border-ink/25 px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-ink disabled:opacity-35"
        aria-label={m.sim.prev}
      >
        ← <span className="hidden sm:inline">{m.sim.prev}</span>
      </button>
      {phase === "journey" && (
        <button
          type="button"
          onClick={next}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-parchment-light transition-colors hover:bg-ink-soft"
        >
          {index === last ? finalLabel : m.sim.next} →
        </button>
      )}
    </div>
  );

  const overlays = (
    <div className={`pointer-events-none absolute z-10 flex flex-col items-start gap-2 ${desktop ? "top-24 left-5" : "top-[4.6rem] left-3"}`}>
      {returnLabel && (
        <button
          type="button"
          onClick={goBackToSource}
          className="paper-card pointer-events-auto max-w-[17rem] truncate rounded-full px-3 py-1.5 text-left text-xs font-medium text-lapis hover:text-ink"
          data-testid="return-link"
        >
          ← {returnLabel}
        </button>
      )}
      {selectedPlace ? (
        <PlaceCard
          place={selectedPlace}
          year={shownStep.year}
          capital={!!snapshot?.polities.some((p) => p.capitalId === selectedPlace.id)}
          steps={steps}
          locale={locale}
          m={m}
          onGoto={(i) => go(i)}
          onClose={() => setPlaceId(null)}
        />
      ) : polityId ? (
        <PolityPanel
          polityId={polityId}
          year={shownStep.year}
          step={final ? null : step}
          snapshot={snapshot}
          political={data.political}
          landmarks={data.landmarks}
          currentPersonHref={data.path.startsWith("/persons/") ? data.path : null}
          locale={locale}
          m={m}
          onFollow={followHref}
          onClose={() => setPolityId(null)}
        />
      ) : (
        <MapLegend
          key={desktop ? "d" : "m"}
          snapshot={snapshot}
          battle={battleLegend}
          locale={locale}
          m={m}
          defaultOpen={desktop && !teacher}
          onSelectPolity={setPolityId}
        />
      )}
    </div>
  );

  const gateProps = {
    title,
    subtitle: data.subtitle,
    ...(data.image ? { image: data.image } : {}),
    locale,
    m,
    resume,
    onStart: start,
  };

  return (
    <MotionConfig reducedMotion={light ? "always" : "user"}>
      <GlossaryProvider entries={data.glossary} locale={locale} label={m.glossary.label}>
        <main
          className={`fixed inset-0 overflow-hidden bg-parchment ${light ? "lite" : ""}`}
          style={{ "--mood-accent": moodStyle.accent } as React.CSSProperties}
          data-mood={mood}
        >
          <MapStage
            steps={steps}
            places={places}
            landmarks={data.landmarks}
            snapshots={data.snapshots}
            polityColors={data.polityColors}
            index={index}
            phase={phase}
            padding={padding}
            reducedMotion={reduced}
            light={light}
            locale={locale}
            messages={m}
            onSelectPlace={setPlaceId}
            onBattleArrow={onBattleArrow}
            onFollow={(ref: ResolvedRef) => ref.href && followHref(ref.href)}
            onSelectPolity={setPolityId}
          />

          {/* Mood colour grading, parchment grain and vignette over the map. */}
          <div aria-hidden className="mood-grade pointer-events-none absolute inset-0" style={{ backgroundColor: moodStyle.grade, opacity: moodStyle.gradeOpacity }} />
          {!light && <div aria-hidden className="map-paper pointer-events-none absolute inset-0" />}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 transition-shadow duration-[1500ms]"
            style={{ boxShadow: `inset 0 0 ${desktop ? 160 : 90}px rgb(60 35 10 / ${moodStyle.vignette})` }}
          />

          <Hud
            title={title}
            indexLink={indexLink}
            counters={counters(shownStep, final)}
            mode={mode}
            setMode={setMode}
            modes={modes}
            m={m}
            locale={locale}
            compact={!desktop}
          />

          {started && overlays}

          {desktop ? (
            <>
              <aside
                className="paper-card absolute top-24 right-5 bottom-5 z-10 flex flex-col overflow-hidden rounded-lg"
                style={{ width: panelW, borderTop: "3px solid var(--mood-accent)" }}
                aria-live="polite"
              >
                <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-6">
                  {panelBody}
                </div>
                <footer className="flex items-center justify-between gap-3 border-t border-ink/10 bg-parchment-light/70 px-5 py-3">
                  <span className="text-xs text-ink-faint tabular-nums">
                    {phase === "journey" ? format(m.sim.stepOf, { current: index + 1, total: steps.length }) : finalTitle}
                  </span>
                  {navButtons}
                </footer>
              </aside>
              <div className="paper-card absolute bottom-5 left-5 z-10 rounded-lg py-3" style={{ right: panelW + 40 }}>
                <Timeline steps={steps} eras={eras} index={final ? last : index} onSelect={go} locale={locale} m={m} />
                {belowTimeline?.(shownStep, final)}
                <p className="mt-1 flex justify-between gap-4 px-6 text-[11px] text-ink-faint">
                  <span>{teacher ? "" : m.sim.keyboardHint}</span>
                  <span>{m.map.attribution}</span>
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="pointer-events-none absolute left-2 z-10 rounded bg-parchment-light/75 px-1.5 text-[10px] text-ink-faint" style={{ bottom: peekH + 6 }}>
                {m.map.attribution}
              </p>
              <BottomSheet sheetH={sheetH} collapsedY={collapsedY} onSwipe={(d) => (d > 0 ? next() : prev())} scrollRef={scrollRef}>
                <div className="px-1">
                  <Timeline steps={steps} eras={eras} index={final ? last : index} onSelect={go} locale={locale} m={m} compact />
                  {belowTimeline?.(shownStep, final)}
                </div>
                <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 pt-2 pb-3">
                  {modes ? <ModeToggle mode={mode} setMode={setMode} m={m} /> : <span />}
                  {navButtons}
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-10">
                  {panelBody}
                </div>
              </BottomSheet>
            </>
          )}

          <AnimatePresence>
            {!started && (
              <Suspense key="gate" fallback={<StartGate {...gateProps} jump={null} />}>
                <GateController {...gateProps} stepIds={steps.map((s) => s.id)} stepTitle={(i) => t(steps[i]!.title, locale)} />
              </Suspense>
            )}
          </AnimatePresence>
        </main>
      </GlossaryProvider>
    </MotionConfig>
  );
}

function Hud({
  title,
  indexLink,
  counters,
  mode,
  setMode,
  modes,
  m,
  locale,
  compact,
}: {
  title: string;
  indexLink: { href: string; label: string };
  counters: Counter[];
  mode: Mode;
  setMode: (m: Mode) => void;
  modes: boolean;
  m: Messages;
  locale: Locale;
  compact: boolean;
}) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-5">
      <div className="pointer-events-auto paper-card flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 sm:px-4">
        <Link
          href={`/${locale}${indexLink.href}`}
          className="shrink-0 rounded-full border border-ink/20 px-2.5 py-1 text-xs text-ink-soft hover:border-ink hover:text-ink"
          aria-label={indexLink.label}
        >
          ← <span className="hidden sm:inline">{indexLink.label}</span>
        </Link>
        <h1 className="truncate font-display text-base font-semibold text-ink sm:text-xl">{title}</h1>
      </div>

      <div className="pointer-events-auto flex items-start gap-2 sm:gap-3">
        <div className="paper-card flex items-stretch divide-x divide-ink/10 rounded-lg">
          {counters.map((c) => (
            <div key={c.label} className="px-3 py-1.5 text-center sm:px-4">
              <p className="text-[10px] tracking-widest text-ink-faint uppercase">{c.label}</p>
              <AnimatedNumber
                value={c.value}
                prefix={c.prefix ?? ""}
                className={`font-display text-xl font-semibold sm:text-2xl ${c.accent ? "text-carmine" : "text-ink"}`}
              />
            </div>
          ))}
        </div>
        <div className="paper-card rounded-lg p-1">
          <SettingsButton m={m} />
        </div>
        {!compact && modes && (
          <div className="paper-card rounded-lg p-1.5">
            <ModeToggle mode={mode} setMode={setMode} m={m} />
          </div>
        )}
      </div>
    </header>
  );
}

function ModeToggle({ mode, setMode, m }: { mode: Mode; setMode: (m: Mode) => void; m: Messages }) {
  return (
    <div role="radiogroup" aria-label={m.sim.modeLabel} className="relative flex rounded-full bg-ink/5 p-0.5 text-sm">
      {(["story", "learn"] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          onClick={() => setMode(value)}
          className={`relative rounded-full px-3 py-1.5 font-medium transition-colors ${mode === value ? "text-parchment-light" : "text-ink-soft hover:text-ink"}`}
        >
          {mode === value && (
            <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-full bg-lapis" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
          )}
          <span className="relative">{value === "story" ? m.sim.modeStory : m.sim.modeLearn}</span>
        </button>
      ))}
    </div>
  );
}

/** Draggable sheet with two snap points; horizontal swipes on the content change the step. */
function BottomSheet({
  sheetH,
  collapsedY,
  onSwipe,
  scrollRef,
  children,
}: {
  sheetH: number;
  collapsedY: number;
  onSwipe: (dir: 1 | -1) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const y = useMotionValue(collapsedY);
  const controls = useDragControls();
  const reduced = useReducedMotion();
  const touch = useRef<{ x: number; y: number } | null>(null);
  const expandedRef = useRef(false);

  const snap = useCallback(
    (expanded: boolean) => {
      expandedRef.current = expanded;
      animate(y, expanded ? 0 : collapsedY, reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 38 });
    },
    [y, collapsedY, reduced],
  );

  // Re-snap when the viewport (and so the snap points) changes.
  useEffect(() => snap(expandedRef.current), [snap]);

  return (
    <motion.section
      className="paper-card absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl"
      style={{ height: sheetH, y, touchAction: "pan-y" }}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: collapsedY }}
      dragElastic={0.06}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        const goingUp = info.velocity.y < -250 || info.offset.y < -60;
        const goingDown = info.velocity.y > 250 || info.offset.y > 60;
        snap(goingUp ? true : goingDown ? false : expandedRef.current);
      }}
      onScrollCapture={(e) => {
        // Reading further than the peek height should reveal the whole sheet.
        if (!expandedRef.current && (e.target as HTMLElement).scrollTop > 24) snap(true);
      }}
      onTouchStart={(e) => {
        const p = e.touches[0];
        if (p) touch.current = { x: p.clientX, y: p.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        const p = e.changedTouches[0];
        touch.current = null;
        if (!start || !p) return;
        const dx = p.clientX - start.x;
        const dy = p.clientY - start.y;
        const target = e.target as HTMLElement;
        // Ignore swipes on the horizontally scrolling timeline.
        if (target.closest("nav")) return;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) onSwipe(dx < 0 ? 1 : -1);
      }}
    >
      <div
        className="flex shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-1.5 active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
        onClick={() => {
          snap(!expandedRef.current);
          scrollRef.current?.scrollTo({ top: 0 });
        }}
        role="button"
        tabIndex={0}
        aria-label="↕"
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && snap(!expandedRef.current)}
      >
        <span className="h-1.5 w-12 rounded-full bg-ink/25" />
      </div>
      {children}
    </motion.section>
  );
}
