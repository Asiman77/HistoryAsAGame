"use client";

import { useEffect, useRef, useState } from "react";
import type { Howl } from "howler";
import type { Locale, NarrationAudio } from "@/domain/schema";
import { getAudioEngine } from "@/features/audio/engine";
import { t, type Messages } from "@/lib/i18n";
import { activeCueIndex } from "@/lib/narration";

/**
 * Narrator playback on the voice channel with subtitles that follow the audio.
 * Reserved for recorded or TTS narration; no event ships audio yet.
 */
export function Narration({ narration, locale, m }: { narration: NarrationAudio; locale: Locale; m: Messages }) {
  const [playing, setPlaying] = useState(false);
  const [cue, setCue] = useState(-1);
  const howlRef = useRef<Howl | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      getAudioEngine().stopVoice();
    },
    [narration.src],
  );

  const follow = () => {
    const h = howlRef.current;
    if (!h) return;
    setCue(activeCueIndex(narration.cues, h.seek() as number));
    if (h.playing()) rafRef.current = requestAnimationFrame(follow);
  };

  const toggle = async () => {
    const engine = getAudioEngine();
    if (playing) {
      engine.stopVoice();
      setPlaying(false);
      setCue(-1);
      return;
    }
    const h = await engine.playVoice(narration.src);
    if (!h) return;
    howlRef.current = h;
    setPlaying(true);
    h.once("end", () => {
      setPlaying(false);
      setCue(-1);
    });
    rafRef.current = requestAnimationFrame(follow);
  };

  const current = narration.cues[cue];
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        className="inline-flex items-center gap-2 self-start rounded-full border border-ink/25 px-3 py-1 text-sm text-ink hover:border-ink"
      >
        <span aria-hidden>{playing ? "❚❚" : "▶"}</span>
        {playing ? m.narration.pause : m.narration.play}
      </button>
      {playing && (
        <p aria-live="polite" aria-label={m.narration.subtitles} className="min-h-[1.5em] rounded bg-ink/80 px-3 py-1.5 text-center text-sm text-parchment-light">
          {current ? t(current.text, locale) : " "}
        </p>
      )}
    </div>
  );
}
