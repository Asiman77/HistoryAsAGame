"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Locale, Person } from "@/domain/schema";
import { Divider } from "@/components/Ornament";
import { SpeakerIcon } from "@/features/settings/SettingsPanel";
import { withBasePath } from "@/lib/basePath";
import { formatDate } from "@/lib/dates";
import { format, t, type Messages } from "@/lib/i18n";
import { updateSettings, useSettings } from "@/lib/settings";

export type StartChoice = { kind: "begin" } | { kind: "resume"; index: number } | { kind: "jump"; index: number };

interface Props {
  person: Person;
  locale: Locale;
  m: Messages;
  /** Saved position, if the viewer has been here before. */
  resume: { index: number; title: string } | null;
  /** Stage requested by a link from another person's story. */
  jump: { index: number; title: string } | null;
  onStart: (choice: StartChoice) => void;
}

/**
 * First screen of a journey. Browsers only allow sound after a user gesture,
 * so the story (and its music) starts with this click.
 */
export function StartGate({ person, locale, m, resume, jump, onStart }: Props) {
  const reduced = useReducedMotion();
  const s = useSettings();
  const year = (d: Person["birth"]["date"]) => formatDate({ ...d, month: undefined, day: undefined }, m);

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
        {person.portrait && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={withBasePath(person.portrait.src)}
            alt={t(person.portrait.alt, locale)}
            className="size-28 rounded-full border-4 border-gold/70 object-cover object-top shadow-lg [filter:sepia(0.35)]"
          />
        )}
        <h1 id="start-title" className="mt-4 font-display text-3xl font-semibold text-ink">
          {t(person.name, locale)}
        </h1>
        <p className="text-sm text-ink-soft">{format(m.start.years, { from: year(person.birth.date), to: year(person.death.date) })}</p>
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
