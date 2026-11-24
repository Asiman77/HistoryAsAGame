"use client";

import { useEffect, useRef } from "react";
import { getAudioEngine } from "@/features/audio/engine";
import { musicThemeSound } from "@/features/audio/manifest";
import type { Settings } from "@/lib/settings";
import type { ShellStep } from "./types";

const soundOf = (s: ShellStep) => musicThemeSound(s.musicThemeId ?? undefined, s.mood) ?? null;

/**
 * Mood music of the shell with the existing audio engine (§8): starts on the
 * first gesture (autoplay rule), follows the step's mood with a crossfade,
 * warms up the next step's sound, plays a short effect on arrival, stops when
 * the simulation is left. Channels, levels and the full mood map are phase 12.
 */
export function useShellAudio(step: ShellStep, next: ShellStep | null, settings: Settings) {
  const engine = getAudioEngine();
  const current = useRef({ step, settings });
  useEffect(() => {
    current.current = { step, settings };
  });

  useEffect(() => {
    engine.applySettings(settings);
  }, [engine, settings]);

  // The first click, tap or key press unlocks audio.
  useEffect(() => {
    if (engine.isStarted) return;
    const start = () => {
      remove();
      const { step: s, settings: st } = current.current;
      void engine.start(st, s.mood, soundOf(s));
    };
    const remove = () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    return remove;
  }, [engine]);

  const first = useRef(true);
  useEffect(() => {
    engine.setMood(step.mood, false, soundOf(step));
    if (next && (next.mood !== step.mood || soundOf(next))) void engine.preload(next.mood, soundOf(next));
    if (first.current) {
      first.current = false;
      return;
    }
    engine.playSfx(step.battle ? "drum" : "whoosh");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  useEffect(() => () => engine.stopAll(), [engine]);
}
