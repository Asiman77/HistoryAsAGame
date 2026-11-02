"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import type { Hero, Locale, Mood, Settlement } from "@/domain/schema";
import { EventIcon } from "@/components/EventIcon";
import { getAudioEngine } from "@/features/audio/engine";
import type { MoodSound } from "@/features/audio/manifest";
import { RelatedLinks } from "@/features/engine/RelatedLinks";
import { SimulationEngine } from "@/features/engine/SimulationEngine";
import { Quiz } from "@/features/legacy/LegacyPanel";
import { formatDate } from "@/lib/dates";
import { format, t, type Messages } from "@/lib/i18n";
import { recordQuiz } from "@/lib/progress";
import { AzFlag, WarIntro } from "./Flag";
import { FLAG, liberationLayer } from "./liberation";
import type { ConflictSimulationData, ConflictStep } from "./model";

type Overlay = "heroes" | "commanders" | null;

/**
 * The war's own soundtrack (original music, docs/AUDIO_CREDITS.md): a march on
 * operation days, the anthem on liberation days, anthem with the triumph layer
 * for Şuşa, and the quiet lament on memorial days and in the heroes memorial.
 */
function warSound(step: ConflictStep, final: boolean, mood: Mood): MoodSound {
  if (mood === "death") return { music: ["lament"], ambience: [] };
  if (final) return { music: ["anthem"], ambience: [] };
  if (step.id === "2020-11-08") return { music: ["anthem", "triumph"], ambience: ["crowd"] };
  if (step.day.kind === "operation" || mood === "battle") return { music: ["march"], ambience: [] };
  return { music: ["anthem"], ambience: [] };
}

/** "Şanlı Zəfər tariximiz": a war day by day on the shared engine. */
export function ConflictSimulation({ data, locale, messages: m }: { data: ConflictSimulationData; locale: Locale; messages: Messages }) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const extension = useMemo(() => liberationLayer(data.settlements, data.liberatedAt), [data.settlements, data.liberatedAt]);
  const { conflict } = data;
  const open = (o: Overlay) => {
    setOverlay(o);
    if (o === "heroes") getAudioEngine().playSfx("chime");
  };

  return (
    <>
      <SimulationEngine
        data={data}
        locale={locale}
        messages={m}
        modes={false}
        indexLink={{ href: "/conflicts/", label: m.categories.conflicts.title }}
        finalLabel={m.war.toFinal}
        finalTitle={m.war.finalTitle}
        finalMood="peace"
        // Memorial overlay softens the soundtrack to the lament.
        moodOverride={overlay === "heroes" ? "death" : null}
        soundFor={warSound}
        gate={{ art: <WarIntro date={t(conflict.introDate, locale)} heading={t(conflict.heading, locale)} />, dark: true }}
        mapExtension={extension}
        stepSfx={(s) => (s.day.kind === "memorial" ? null : s.id === "2020-11-08" ? "victory" : s.day.kind === "operation" || s.mood === "battle" ? "drum" : "whoosh")}
        counters={(step, final) => {
          const last = data.steps.at(-1)!;
          const s = final ? last : step;
          return [
            ...(s.day.dayNumber ? [{ label: m.war.day, value: s.day.dayNumber }] : [{ label: m.sim.year, value: s.year }]),
            { label: m.war.liberatedCounter, value: s.liberatedTotal, accent: true },
          ];
        }}
        renderStep={({ step, here, openPlace, index }) => (
          <DayContent step={step} index={index} data={data} locale={locale} m={m} here={here} onPlace={openPlace} onOpen={open} />
        )}
        renderFinal={({ teacher, back }) => (
          <div className="flex flex-col gap-5">
            <header>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: FLAG.blue }}>
                {t(conflict.heading, locale)}
              </p>
              <h2 className="mt-1 font-display text-3xl font-semibold text-ink">{t(conflict.name, locale)}</h2>
              <p className="text-sm text-ink-soft">{conflict.years}</p>
            </header>
            <AzFlag className="w-28 rounded-sm shadow" wave />
            <p className="font-serif text-[1.05rem] leading-relaxed text-ink">{t(conflict.legacy, locale)}</p>
            {conflict.finalNotes?.map((n) => (
              <section key={n.title.az} className="rounded-md border border-ink/10 bg-parchment/50 p-3">
                <h3 className="font-display text-lg font-semibold text-ink">{t(n.title, locale)}</h3>
                <p className="mt-1 text-sm text-ink-soft">{t(n.text, locale)}</p>
              </section>
            ))}
            <OverlayButtons m={m} onOpen={open} count={data.heroes.length} />
            {data.quiz.length > 0 && <Quiz questions={data.quiz} locale={locale} m={m} teacher={teacher} onFinish={(sc, tot) => recordQuiz(data.key, sc, tot)} />}
            <div className="flex flex-wrap gap-2">
              <Link href={`/${locale}/conflicts/`} className="rounded-full border border-ink/30 px-4 py-2 text-sm font-medium text-ink hover:border-ink">
                {m.categories.conflicts.title}
              </Link>
              <button type="button" onClick={back} className="px-2 py-2 text-sm text-ink-soft underline underline-offset-2">
                {m.legacy.backToJourney}
              </button>
            </div>
            {data.pendingTracks > 0 && <p className="text-[11px] text-ink-faint">{format(m.war.musicPending, { n: data.pendingTracks })}</p>}
          </div>
        )}
      />
      {overlay === "heroes" && <HeroesMemorial heroes={data.heroes} locale={locale} m={m} onClose={() => setOverlay(null)} />}
      {overlay === "commanders" && <CommandersPanel data={data} locale={locale} m={m} onClose={() => setOverlay(null)} />}
    </>
  );
}

function OverlayButtons({ m, onOpen, count }: { m: Messages; onOpen: (o: Overlay) => void; count: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => onOpen("heroes")} className="inline-flex items-center gap-2 rounded-full border border-carmine/40 bg-carmine/5 px-3.5 py-1.5 text-sm font-medium text-carmine hover:bg-carmine/10">
        <Carnation size={16} /> {format(m.war.heroesButton, { n: count })}
      </button>
      <button type="button" onClick={() => onOpen("commanders")} className="inline-flex items-center gap-2 rounded-full border border-lapis/40 bg-lapis/5 px-3.5 py-1.5 text-sm font-medium text-lapis hover:bg-lapis/10">
        ★ {m.war.commandersButton}
      </button>
    </div>
  );
}

function DayContent({
  step,
  index,
  data,
  locale,
  m,
  here,
  onPlace,
  onOpen,
}: {
  step: ConflictStep;
  index: number;
  data: ConflictSimulationData;
  locale: Locale;
  m: Messages;
  here: { href: string; label: string };
  onPlace: (id: string) => void;
  onOpen: (o: Overlay) => void;
}) {
  const reduced = useReducedMotion();
  const { day } = step;
  const memorial = day.kind === "memorial";
  const shusha = day.id === "2020-11-08";
  const byDistrict = new Map<string, Settlement[]>();
  for (const s of step.liberatedNow) {
    const k = t(s.district, locale);
    byDistrict.set(k, [...(byDistrict.get(k) ?? []), s]);
  }
  const repeated = (s: Settlement) => data.liberatedAt[s.id] !== undefined && data.liberatedAt[s.id]! < index;
  const commanders = (day.commanders ?? []).map((id) => data.commanders.find((c) => c.id === id)).filter((c) => !!c);

  return (
    <article className={`flex flex-col gap-4 ${memorial ? "candle-glow" : ""}`}>
      {shusha && (
        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-md p-4 text-center"
          style={{ background: `linear-gradient(135deg, ${FLAG.blue}22, ${FLAG.red}22, ${FLAG.green}22)` }}
          data-testid="shusha-banner"
        >
          <AzFlag className="mx-auto w-40 rounded-sm shadow-lg" wave />
          <p className="mt-3 font-display text-2xl font-semibold text-ink">{m.war.shushaBanner}</p>
        </motion.div>
      )}
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-medium tracking-wide text-white uppercase" style={{ background: memorial ? "#4a4a55" : "var(--mood-accent)" }}>
            {memorial ? <Carnation size={13} /> : <EventIcon type={step.icon} size={13} />}
            {m.war.kinds[day.kind]}
          </span>
          <span className="font-medium text-ink-soft">{formatDate(day.date, m)}</span>
          {day.dayNumber && <span className="text-ink-faint">· {format(m.war.dayOf, { n: day.dayNumber })}</span>}
        </div>
        <h2 className="mt-3 font-display text-[1.7rem] leading-tight font-semibold text-ink sm:text-3xl">{t(day.title, locale)}</h2>
      </header>

      <p className={`leading-relaxed text-ink ${memorial ? "font-serif text-[1.05rem]" : ""}`}>{t(day.summary, locale)}</p>

      {memorial && <p className="text-sm text-ink-soft italic">{m.war.memorialNote}</p>}

      {step.liberatedNow.length > 0 && (
        <section aria-label={m.war.liberatedTitle} className="rounded-md border p-3" style={{ borderColor: `${FLAG.green}55`, background: `${FLAG.green}0d` }}>
          <h3 className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: FLAG.green }}>
            {format(m.war.liberatedCount, { n: step.liberatedNow.filter((s) => !repeated(s)).length })}
          </h3>
          {[...byDistrict].map(([district, list]) => (
            <p key={district} className="mt-1.5 text-sm leading-relaxed text-ink">
              <span className="font-semibold">{district}: </span>
              {list.map((s, i) => (
                <span key={s.id} className={s.lat === undefined ? "text-ink-soft italic" : ""} title={s.lat === undefined ? m.war.noCoordinate : undefined}>
                  {i > 0 && ", "}
                  {t(s.name, locale)}
                  {s.kind !== "village" && ` (${m.war.settlementKinds[s.kind]})`}
                  {repeated(s) && ` (${m.war.repeated})`}
                </span>
              ))}
            </p>
          ))}
        </section>
      )}
      {day.extraLiberated && (day.extraLiberated.villages || day.extraLiberated.towns || day.extraLiberated.heights) ? (
        <p className="text-sm text-ink-soft">
          {format(m.war.extraLiberated, { villages: day.extraLiberated.villages ?? 0, towns: day.extraLiberated.towns ?? 0, heights: day.extraLiberated.heights ?? 0 })}
        </p>
      ) : null}

      {commanders.length > 0 && (
        <p className="text-sm text-ink">
          <span className="text-ink-faint">{m.war.commandersOfDay}: </span>
          {commanders.map((c, i) => (
            <span key={c!.id}>
              {i > 0 && ", "}
              <button type="button" onClick={() => onOpen("commanders")} className="font-medium text-lapis underline decoration-lapis/30 underline-offset-2">
                {t(c!.name, locale)}
              </button>
            </span>
          ))}
        </p>
      )}

      {day.officialStatement && (
        <a href={day.officialStatement.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 self-start rounded-md border border-ink/15 bg-parchment/50 px-3 py-2 text-sm text-lapis hover:border-lapis">
          📜 {t(day.officialStatement.title, locale)}
        </a>
      )}

      <RelatedLinks refs={step.related} locale={locale} m={m} here={here} onPlace={onPlace} />
      <OverlayButtons m={m} onOpen={onOpen} count={data.heroes.length} />

      <div>
        <p className="text-xs font-semibold tracking-wide text-ink uppercase">{m.sim.sources}</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-ink-soft marker:text-ink-faint">
          {day.sources.map((s, i) => (
            <li key={i}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer" className="text-lapis underline decoration-lapis/30 underline-offset-2">
                  {s.title}
                </a>
              ) : (
                s.title
              )}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11px] text-ink-faint">{m.war.mapNote}</p>
      </div>
    </article>
  );
}

/** Memorial for the heroes: calm, candle-lit, carnations; names from the official decree. */
function HeroesMemorial({ heroes, locale, m, onClose }: { heroes: Hero[]; locale: Locale; m: Messages; onClose: () => void }) {
  const reduced = useReducedMotion();
  const fallen = heroes.filter((h) => h.posthumous);
  const living = heroes.filter((h) => !h.posthumous);
  const group = (title: string, list: Hero[], posthumous: boolean) => (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider text-[#e9d9b0] uppercase">
        {posthumous && <Carnation size={14} />} {title} ({list.length})
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {list.map((h) => (
          <li key={h.id} className="flex items-center gap-3 rounded-md bg-white/5 p-2.5">
            <HeroAvatar />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{t(h.name, locale)}</p>
              <p className="text-xs text-white/70">
                {t(h.rank, locale)}
                {h.posthumous && ` · ${m.war.posthumous}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="heroes-title"
      className="fixed inset-0 z-[60] overflow-y-auto bg-[#0b0d12]/95 p-4 sm:p-8"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2 }}
      data-testid="heroes-memorial"
    >
      <div className="candle-glow mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.3em] text-[#e9d9b0] uppercase">{m.war.memorialKicker}</p>
            <h2 id="heroes-title" className="mt-1 font-display text-3xl text-white">
              {m.war.heroesTitle}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/75">{m.war.heroesLead}</p>
          </div>
          <button type="button" onClick={onClose} autoFocus className="rounded-full border border-white/30 px-3 py-1.5 text-sm text-white hover:bg-white/10">
            {m.map.close}
          </button>
        </div>
        <div className="mt-6 flex flex-col gap-6">
          {group(m.war.fallenHeroes, fallen, true)}
          {group(m.war.livingHeroes, living, false)}
        </div>
        <p className="mt-6 text-[11px] text-white/55">{m.war.heroesSource}</p>
      </div>
    </motion.div>,
    document.body,
  );
}

function CommandersPanel({ data, locale, m, onClose }: { data: ConflictSimulationData; locale: Locale; m: Messages; onClose: () => void }) {
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="commanders-title" className="fixed inset-0 z-[60] grid place-items-center bg-ink/50 p-4" data-testid="commanders-panel">
      <div className="paper-card max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="commanders-title" className="font-display text-2xl font-semibold text-ink">
            {m.war.commandersTitle}
          </h2>
          <button type="button" onClick={onClose} autoFocus className="rounded-full border border-ink/25 px-3 py-1 text-sm text-ink hover:border-ink">
            {m.map.close}
          </button>
        </div>
        <ul className="mt-4 space-y-3">
          {data.commanders.map((c) => (
            <li key={c.id} className="rounded-md border border-ink/10 bg-parchment/50 p-3">
              <p className="font-display text-lg font-semibold text-ink">{t(c.name, locale)}</p>
              <p className="text-xs text-ink-soft">{t(c.position, locale)}</p>
              <p className="mt-1 text-sm text-ink">{t(c.role, locale)}</p>
              <p className="mt-1 text-[11px] text-ink-faint">
                {m.sim.sources}:{" "}
                {c.sources.map((s, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      {s.title}
                    </a>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-ink-faint">{m.war.commandersNote}</p>
      </div>
    </div>,
    document.body,
  );
}

/** Respectful placeholder until an official, licensed photo is added: silhouette over the flag colours. */
function HeroAvatar() {
  return (
    <svg viewBox="0 0 40 40" className="size-10 shrink-0 rounded-full" aria-hidden>
      <rect width="40" height="13.4" fill={FLAG.blue} opacity="0.55" />
      <rect y="13.3" width="40" height="13.4" fill={FLAG.red} opacity="0.55" />
      <rect y="26.6" width="40" height="13.4" fill={FLAG.green} opacity="0.55" />
      <circle cx="20" cy="16" r="6.5" fill="#1b1f27" />
      <path d="M8 38c1.5-8 6.5-11 12-11s10.5 3 12 11z" fill="#1b1f27" />
    </svg>
  );
}

export function Carnation({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M12 22V11" stroke="#3f7a3a" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 16c-2-1-4-1-5 0 1.5.6 3 .6 5 0z" fill="#3f7a3a" />
      <path d="M12 3c1 1.5 3 1 3.6 2.6C17.4 5 18 7 17 8.2c1 1.2-.4 3-2 2.8-.6 1.4-2.6 1.6-3 .4-.4 1.2-2.4 1-3-.4-1.6.2-3-1.6-2-2.8C6 7 6.6 5 8.4 5.6 9 4 11 4.5 12 3z" fill="#c4161c" />
    </svg>
  );
}
