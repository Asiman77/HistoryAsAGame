"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import type { ImageAsset, Locale } from "@/domain/schema";
import { Divider } from "@/components/Ornament";
import { getAudioEngine } from "@/features/audio/engine";
import { SpeakerIcon } from "@/features/settings/SettingsPanel";
import { withBasePath } from "@/lib/basePath";
import { format, t, type Messages } from "@/lib/i18n";
import { updateSettings, useSettings } from "@/lib/settings";

export type StartChoice = { kind: "begin" } | { kind: "resume"; index: number } | { kind: "jump"; index: number };

export interface GateTarget {
  index: number;
  title: string;
}

interface GateProps {
  title: string;
  subtitle: string;
  image?: ImageAsset;
  locale: Locale;
  m: Messages;
  resume: GateTarget | null;
  jump: GateTarget | null;
  onStart: (choice: StartChoice) => void;
}

/**
 * Reads ?step= (a deep link from another simulation). Lives in its own
 * Suspense boundary so the rest of the page is still prerendered. When the
 * viewer arrives by an in-app link the audio is already unlocked, so the gate
 * is skipped and the story opens at the linked step.
 */
export function GateController({
  stepIds,
  stepTitle,
  ...props
}: Omit<GateProps, "jump"> & { stepIds: string[]; stepTitle: (i: number) => string }) {
  const params = useSearchParams();
  const stepParam = params.get("step");
  const jumpIndex = stepParam ? stepIds.indexOf(stepParam) : -1;
  const jump = jumpIndex >= 0 ? { index: jumpIndex, title: stepTitle(jumpIndex) } : null;
  const auto = useRef(false);
  const { onStart } = props;

  useEffect(() => {
    if (auto.current || jumpIndex < 0 || !getAudioEngine().isStarted) return;
    auto.current = true;
    onStart({ kind: "jump", index: jumpIndex });
  }, [jumpIndex, onStart]);

  return <StartGate {...props} jump={jump} />;
}

/**
 * First screen of a simulation. Browsers only allow sound after a user
 * gesture, so the story (and its music) starts with this click.
 */
export function StartGate({ title, subtitle, image, locale, m, resume, jump, onStart }: GateProps) {
  const reduced = useReducedMotion();
  const s = useSettings();

  return (
    <motion.div
      className="absolute inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-[2px]"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-title"
        className="paper-card miniature-frame flex w-full max-w-md flex-col items-center rounded-xl p-6 text-center sm:p-8"
        initial={reduced ? false : { y: 16, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={withBasePath(image.src)}
            alt={t(image.alt, locale)}
            className="size-28 rounded-full border-4 border-gold/70 object-cover object-top shadow-lg [filter:sepia(0.35)]"
          />
        )}
        <h1 id="start-title" className="mt-4 font-display text-3xl font-semibold text-ink">
          {title}
        </h1>
        <p className="text-sm text-ink-soft">{subtitle}</p>
        <Divider className="my-4 w-48" />
        <div className="flex w-full flex-col gap-2">
          {jump ? (
            <>
              <button type="button" autoFocus onClick={() => onStart({ kind: "jump", index: jump.index })} className="btn-primary">
                {format(m.start.deepLink, { title: jump.title })}
              </button>
              <button type="button" onClick={() => onStart({ kind: "begin" })} className="btn-secondary">
                {m.start.restart}
              </button>
            </>
          ) : resume ? (
            <>
              <button type="button" autoFocus onClick={() => onStart({ kind: "resume", index: resume.index })} className="btn-primary">
                {m.start.resume}
                <span className="block text-xs font-normal opacity-80">
                  {format(m.start.resumeAt, { n: resume.index + 1, title: resume.title })}
                </span>
              </button>
              <button type="button" onClick={() => onStart({ kind: "begin" })} className="btn-secondary">
                {m.start.restart}
              </button>
            </>
          ) : (
            <button type="button" autoFocus onClick={() => onStart({ kind: "begin" })} className="btn-primary">
              {m.start.begin}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => updateSettings({ muted: !s.muted })}
          aria-pressed={s.muted}
          className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-ink-soft hover:bg-ink/5"
        >
          <SpeakerIcon muted={s.muted} size={16} />
          {s.muted ? m.start.soundOff : m.start.sound} · <span className="underline">{s.muted ? m.start.enableSound : m.start.toggleSound}</span>
        </button>
      </motion.section>
    </motion.div>
  );
}
