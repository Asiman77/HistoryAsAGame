"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PeriodTheme } from "@/components/layout/PeriodTheme";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Panel } from "@/components/ui/Panel";
import { getAudioEngine } from "@/features/audio/engine";
import { Link } from "@/i18n/navigation";
import { ownerOf, track } from "@/lib/analytics/client";
import { comitative, genitive } from "@/lib/nameCase";
import { progressStore, recordQuiz, saveProgress, useProgress } from "@/lib/progress";
import { ROUTES } from "@/lib/routes";
import { markStampsSeen, usePassport } from "@/stores/passport";
import type { FinalData } from "./finalAdapter";
import { FinalQuiz } from "./FinalQuiz";
import { LifeRoute } from "./LifeRoute";
import { Stamp } from "./PassportStamps";

const SHOWN_STAMPS = 4;

/** A figure of the life (§6.9: only what the data gives): label, big serif number, an optional note. */
function Figure({ label, children, note }: { label: string; children: React.ReactNode; note?: string | null }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-panel border border-line bg-surface/80 px-5 py-4">
      <dt className="text-13 text-fg-secondary">{label}</dt>
      <dd className="m-0 font-heading text-34 font-medium leading-none text-fg">{children}</dd>
      {note ? <dd className="m-0 max-w-[190px] text-12 text-fg-muted">{note}</dd> : null}
    </div>
  );
}
/** The stamps land after the screen has settled. */
const STAMP_DELAY_MS = 700;
const STAMP_STAGGER_MS = 160;

/**
 * Final screen of a person (§6.9, artboard "Final"): the whole life route
 * drawn again, statistics from data, the quiz, new passport stamps, and the
 * way on (home, compare). Reaching it from the last step completes the
 * journey: progress, the collection card and an anonymous completion event.
 * One DOM for every width: a column on phones, the artboard's layout from lg.
 */
export function FinalScreen({ data }: { data: FinalData }) {
  const t = useTranslations("final");
  const progress = useProgress().persons[data.key];
  const passportStamps = usePassport((p) => p.stamps);
  const owner = useMemo(() => ownerOf(`person:${data.key}`), [data.key]);

  // Completion: only when the story was followed to its end, never by opening the URL alone.
  useEffect(() => {
    const saved = progressStore.get().persons[data.key];
    if (!saved || saved.furthest < data.lastIndex) return;
    const first = !saved.completed || saved.phase !== "legacy";
    saveProgress(data.key, { index: data.stepCount - 1, phase: "legacy", choices: saved.choices }, data.stepCount);
    if (first) track({ type: "simulation_completed", ...owner });
  }, [data.key, data.lastIndex, data.stepCount, owner]);

  // Stamps of this journey the student has; the ones no final screen has shown yet are new.
  const stamps = data.stamps
    .map((s) => ({ ...s, own: passportStamps[s.id] }))
    .filter((s) => s.own)
    .map((s) => ({ ...s, fresh: !s.own!.seen }));
  const fresh = stamps.filter((s) => s.fresh);
  const shown = (fresh.length ? fresh : stamps).slice(0, SHOWN_STAMPS);
  const more = stamps.length - shown.length;

  // A soft thud as they land (the audio engine is running after a journey); they count as seen when the page is left.
  const freshKey = fresh.map((s) => s.id).join(",");
  const thudded = useRef(false);
  useEffect(() => {
    if (!freshKey || thudded.current) return;
    thudded.current = true;
    const id = window.setTimeout(() => getAudioEngine().playSfx("drum"), STAMP_DELAY_MS + 200);
    return () => window.clearTimeout(id);
  }, [freshKey]);
  const freshIds = useRef<string[]>([]);
  useEffect(() => {
    freshIds.current = [...new Set([...freshIds.current, ...fresh.map((s) => s.id)])];
  });
  useEffect(() => {
    const seen = () => markStampsSeen(freshIds.current);
    window.addEventListener("pagehide", seen);
    return () => {
      window.removeEventListener("pagehide", seen);
      seen();
    };
  }, []);

  const choiceIds = Object.keys(data.choices);
  const answered = choiceIds.filter((id) => progress?.choices[id] !== undefined);
  const matched = answered.filter((id) => progress?.choices[id] === data.choices[id]);

  return (
    <main
      className="relative isolate min-h-dvh overflow-hidden"
      style={{ background: "radial-gradient(ellipse 50% 60% at 30% 40%, color-mix(in srgb, var(--secondary) 40%, transparent), transparent 70%), var(--bg-base)" }}
      data-testid="final-screen"
      data-completed={progress?.completed ? "true" : "false"}
    >
      <PeriodTheme id={data.themeId} />
      <div className="flex flex-col gap-6 px-4 pb-10 pt-4 sm:px-8 lg:relative lg:block lg:h-dvh lg:min-h-[820px] lg:p-0">
        <div className="flex max-w-[560px] flex-col gap-2.5 lg:absolute lg:left-12 lg:top-6 lg:z-10">
          <Link href={data.simHref} className="mb-2 inline-flex min-h-11 items-center gap-2 self-start text-14 text-fg-secondary hover:text-accent" data-testid="final-back">
            <ArrowLeft aria-hidden size={18} /> {t("back")}
          </Link>
          <Eyebrow as="p" className="text-13 tracking-[0.22em]">
            {t("eyebrow", { years: data.years })}
          </Eyebrow>
          <h1 className="m-0 font-heading text-44 font-medium leading-[1.05] text-fg lg:text-60">{t("title", { name: data.name, nameGen: genitive(data.name) })}</h1>
          <p className="m-0 max-w-[500px] text-16 leading-relaxed text-fg-secondary">{data.legacy}</p>
        </div>

        <LifeRoute route={data.route} title={t("route")} className="h-[300px] w-full sm:h-[380px] lg:absolute lg:left-0 lg:top-[43%] lg:h-[36%] lg:w-[55%] lg:opacity-90" />

        <div className="flex flex-col gap-3 lg:absolute lg:bottom-10 lg:left-12 lg:z-10 lg:max-w-[calc(100%-640px)]">
          <dl className="m-0 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap" data-testid="final-stats">
            <Figure label={t("stats.steps")}>
              <AnimatedNumber value={data.stats.steps} />
            </Figure>
            <Figure label={t("stats.battles")} note={data.stats.battles ? t("stats.battlesDetail", { victories: data.stats.victories, defeats: data.stats.defeats }) : null}>
              <AnimatedNumber value={data.stats.battles} />
            </Figure>
            <Figure label={t("stats.places")}>
              <AnimatedNumber value={data.stats.places} />
            </Figure>
            <Figure label={t("stats.distance")} note={t("stats.distanceNote")}>
              {t("stats.km", { km: data.stats.km })}
            </Figure>
          </dl>
          {answered.length ? (
            <p className="m-0 text-14 text-fg-secondary" data-testid="final-choices">
              {t("stats.choices", { match: matched.length, total: choiceIds.length })}
            </p>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6 lg:absolute lg:bottom-10 lg:right-10 lg:top-10 lg:z-10 lg:w-[520px] lg:gap-[18px]">
          <Panel className="flex min-h-[420px] flex-col overflow-y-auto p-6 lg:min-h-0 lg:flex-1 lg:p-7">
            <FinalQuiz personId={data.key} deck={data.deck} land={data.route.land} simHref={data.simHref} onFinish={(score, total) => recordQuiz(data.key, score, total)} />
          </Panel>

          <Panel className="flex shrink-0 flex-col gap-3.5 px-6 py-5" data-testid="final-passport">
            <Eyebrow as="p">{fresh.length ? t("stamps.titleNew") : t("stamps.title")}</Eyebrow>
            {stamps.length ? (
              <div className="flex flex-wrap items-center gap-3">
                {shown.map((s, i) => (
                  <Stamp key={s.id} id={s.id} name={s.name} index={i} fresh={s.fresh} delayMs={STAMP_DELAY_MS + i * STAMP_STAGGER_MS} />
                ))}
                {more > 0 ? (
                  <Link
                    href={ROUTES.passport}
                    className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-fg/25 font-heading text-19 text-fg-muted hover:text-fg"
                    aria-label={t("stamps.more", { n: more })}
                  >
                    +{more}
                  </Link>
                ) : null}
                <Link href={ROUTES.passport} className="ml-auto text-14 font-semibold text-accent underline-offset-2 hover:underline">
                  {t("stamps.open")} →
                </Link>
              </div>
            ) : (
              <p className="m-0 text-14 text-fg-secondary">{t("stamps.empty")}</p>
            )}
          </Panel>

          <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
            <ButtonLink href={ROUTES.home} variant="secondary" size="lg" className="sm:flex-1">
              {t("home")}
            </ButtonLink>
            {data.compare ? (
              <ButtonLink href={data.compare.href} size="lg" className="sm:flex-[1.5]" data-testid="final-compare">
                {t("compare", { nameWith: comitative(data.compare.name), name: data.compare.name })} <span aria-hidden>→</span>
              </ButtonLink>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}
