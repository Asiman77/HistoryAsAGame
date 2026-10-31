"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useReducedMotion } from "motion/react";
import type { Locale } from "@/domain/schema";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { MapStage, type Phase } from "@/features/map/MapStage";
import { LegacyPanel } from "@/features/legacy/LegacyPanel";
import { format, t, type Messages } from "@/lib/i18n";
import { useMediaQuery, useViewportHeight } from "@/lib/useMediaQuery";
import { useStoredMode } from "./useStoredMode";
import type { Journey } from "./model";
import { StoryContent, type Mode } from "./StoryContent";
import { Timeline } from "./Timeline";

interface Props {
  journey: Journey;
  locale: Locale;
  messages: Messages;
}

const PANEL_W = 430;

export function SimulationView({ journey, locale, messages: m }: Props) {
  const { person, steps, places, eras } = journey;
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("journey");
  const [dir, setDir] = useState(1);
  const [mode, setMode] = useStoredMode();
  const [choices, setChoices] = useState<Record<string, number>>({});
  const reduced = useReducedMotion() ?? false;
  const desktop = useMediaQuery("(min-width: 1024px)", true);
  const vh = useViewportHeight();
  const scrollRef = useRef<HTMLDivElement>(null);
  const step = steps[index]!;
  const last = steps.length - 1;
  const name = t(person.shortName ?? person.name, locale);


  const go = useCallback(
    (target: number) => {
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
    [index, last, phase],
  );
  const next = useCallback(() => (phase === "legacy" ? undefined : go(index + 1)), [go, index, phase]);
  const prev = useCallback(() => (phase === "legacy" ? go(last) : go(index - 1)), [go, index, last, phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [index, phase]);

  // Mobile bottom sheet geometry.
  const sheetH = Math.round(vh * 0.88);
  const peekH = Math.round(Math.max(vh * 0.44, 300));
  const collapsedY = Math.max(sheetH - peekH, 0);

  const padding = useMemo(
    () =>
      desktop
        ? { top: 96, right: PANEL_W + 48, bottom: 150, left: 48 }
        : { top: 84, right: 28, bottom: peekH + 16, left: 28 },
    [desktop, peekH],
  );

  const restart = () => {
    setChoices({});
    setPhase("journey");
    setDir(-1);
    setIndex(0);
  };

  const panelBody = (
    <AnimatePresence mode="wait" initial={false} custom={dir}>
      <motion.div
        key={phase === "legacy" ? "legacy" : step.event.id}
        custom={dir}
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir * 28 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -28 }}
        transition={{ duration: reduced ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {phase === "legacy" ? (
          <LegacyPanel journey={journey} choices={choices} locale={locale} m={m} onRestart={restart} onBack={() => go(last)} />
        ) : (
          <StoryContent
            step={step}
            personName={name}
            mode={mode}
            locale={locale}
            m={m}
            chosen={choices[step.event.id]}
            onChoose={(i) => setChoices((c) => ({ ...c, [step.event.id]: i }))}
          />
        )}
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
          {index === last ? m.sim.toLegacy : m.sim.next} →
        </button>
      )}
    </div>
  );

  return (
    <main className="fixed inset-0 overflow-hidden bg-parchment">
      <MapStage
        steps={steps}
        places={places}
        index={index}
        phase={phase}
        padding={padding}
        reducedMotion={reduced}
        locale={locale}
        messages={m}
      />

      {/* vignette for an old-map feel */}
      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgb(90_60_20/0.35)]" />

      <Hud
        name={t(person.name, locale)}
        year={phase === "legacy" ? person.death.date.year : step.event.date.year}
        age={phase === "legacy" ? steps[last]!.age : step.age}
        mode={mode}
        setMode={setMode}
        locale={locale}
        m={m}
        compact={!desktop}
      />

      {desktop ? (
        <>
          <aside
            className="paper-card absolute top-24 right-5 bottom-5 z-10 flex flex-col overflow-hidden rounded-lg"
            style={{ width: PANEL_W }}
            aria-live="polite"
          >
            <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-6">
              {panelBody}
            </div>
            <footer className="flex items-center justify-between gap-3 border-t border-ink/10 bg-parchment-light/70 px-5 py-3">
              <span className="text-xs text-ink-faint tabular-nums">
                {phase === "journey" ? format(m.sim.stepOf, { current: index + 1, total: steps.length }) : m.legacy.title}
              </span>
              {navButtons}
            </footer>
          </aside>
          <div
            className="paper-card absolute bottom-5 left-5 z-10 rounded-lg py-3"
            style={{ right: PANEL_W + 40 }}
          >
            <Timeline steps={steps} eras={eras} index={phase === "legacy" ? last : index} onSelect={go} locale={locale} m={m} />
            <p className="mt-1 flex justify-between gap-4 px-6 text-[11px] text-ink-faint">
              <span>{m.sim.keyboardHint}</span>
              <span>{m.map.attribution}</span>
            </p>
          </div>
        </>
      ) : (
        <>
          <p
            className="pointer-events-none absolute left-2 z-10 rounded bg-parchment-light/75 px-1.5 text-[10px] text-ink-faint"
            style={{ bottom: peekH + 6 }}
          >
            {m.map.attribution}
          </p>
          <BottomSheet sheetH={sheetH} collapsedY={collapsedY} onSwipe={(d) => (d > 0 ? next() : prev())} scrollRef={scrollRef}>
            <div className="px-1">
              <Timeline steps={steps} eras={eras} index={phase === "legacy" ? last : index} onSelect={go} locale={locale} m={m} compact />
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 pt-2 pb-3">
              <ModeToggle mode={mode} setMode={setMode} m={m} />
              {navButtons}
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-10">
              {panelBody}
            </div>
          </BottomSheet>
        </>
      )}
    </main>
  );
}

function Hud({
  name,
  year,
  age,
  mode,
  setMode,
  locale,
  m,
  compact,
}: {
  name: string;
  year: number;
  age: { years: number; approximate: boolean };
  mode: Mode;
  setMode: (m: Mode) => void;
  locale: Locale;
  m: Messages;
  compact: boolean;
}) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-5">
      <div className="pointer-events-auto paper-card flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 sm:px-4">
        <Link
          href={`/${locale}/`}
          className="shrink-0 rounded-full border border-ink/20 px-2.5 py-1 text-xs text-ink-soft hover:border-ink hover:text-ink"
          aria-label={m.sim.back}
        >
          ← <span className="hidden sm:inline">{m.sim.back}</span>
        </Link>
        <h1 className="truncate font-display text-base font-semibold text-ink sm:text-xl">{name}</h1>
      </div>

      <div className="pointer-events-auto flex items-start gap-3">
        <div className="paper-card flex items-stretch divide-x divide-ink/10 rounded-lg">
          <div className="px-3 py-1.5 text-center sm:px-4">
            <p className="text-[10px] tracking-widest text-ink-faint uppercase">{m.sim.year}</p>
            <AnimatedNumber value={year} className="font-display text-xl font-semibold text-ink sm:text-2xl" />
          </div>
          <div className="px-3 py-1.5 text-center sm:px-4">
            <p className="text-[10px] tracking-widest text-ink-faint uppercase">{m.sim.age}</p>
            <AnimatedNumber
              value={age.years}
              prefix={age.approximate ? "~" : ""}
              className="font-display text-xl font-semibold text-carmine sm:text-2xl"
            />
          </div>
        </div>
        {!compact && (
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
            <motion.span
              layoutId="mode-pill"
              className="absolute inset-0 rounded-full bg-lapis"
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
            />
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
