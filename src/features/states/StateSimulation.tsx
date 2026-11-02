"use client";

import Link from "next/link";
import type { Locale } from "@/domain/schema";
import { EventIcon } from "@/components/EventIcon";
import { GlossaryText } from "@/components/GlossaryText";
import { RelatedLinks } from "@/features/engine/RelatedLinks";
import { ClaimBadge } from "@/features/claims/ClaimBadge";
import { ClaimList, StepClaimNotice } from "@/features/claims/ClaimList";
import { FactOrLegendQuiz } from "@/features/claims/FactOrLegendQuiz";
import { classifyItems } from "@/lib/claims";
import { SimulationEngine } from "@/features/engine/SimulationEngine";
import { Quiz } from "@/features/legacy/LegacyPanel";
import { CertaintyBadge } from "@/features/simulation/StoryContent";
import { formatDate } from "@/lib/dates";
import { t, type Messages } from "@/lib/i18n";
import { formatReign, reignsAt } from "@/lib/rulers";
import { recordQuiz } from "@/lib/progress";
import { DynastyStrip } from "./DynastyStrip";
import type { StateSimStep, StateSimulationData } from "./model";

/** A state's history on the shared engine: steps are stages, the map shows its borders changing. */
export function StateSimulation({ data, locale, messages: m }: { data: StateSimulationData; locale: Locale; messages: Messages }) {
  const { state, steps, political } = data;
  const from = steps[0]!.year;
  const to = steps.at(-1)!.year;
  return (
    <SimulationEngine
      data={data}
      locale={locale}
      messages={m}
      modes={false}
      indexLink={{ href: "/states/", label: m.categories.states.title }}
      finalLabel={m.states.toLegacy}
      finalTitle={m.legacy.title}
      stepSfx={(s) => (s.mood === "battle" ? "drum" : "whoosh")}
      counters={(step) => [{ label: m.sim.year, value: step.year }]}
      belowTimeline={(step) => (
        <DynastyStrip
          political={political}
          polityIds={state.dynasty ?? [state.polityId]}
          from={from}
          to={to}
          year={step.year}
          locale={locale}
          m={m}
        />
      )}
      renderStep={({ step, here, openPlace }) => <StageContent step={step} data={data} locale={locale} m={m} here={here} onPlace={openPlace} />}
      renderFinal={({ teacher, back }) => (
        <div className="flex flex-col gap-5">
          <header>
            <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{m.legacy.title}</p>
            <h2 className="mt-1 font-display text-3xl font-semibold text-ink">{t(state.name, locale)}</h2>
            <p className="text-sm text-ink-soft">{state.years}</p>
          </header>
          <p className="font-serif text-[1.05rem] leading-relaxed text-ink">{t(state.legacy, locale)}</p>
          {data.quiz.length > 0 && (
            <Quiz questions={data.quiz} locale={locale} m={m} teacher={teacher} onFinish={(score, total) => recordQuiz(data.key, score, total)} />
          )}
          <FactOrLegendQuiz items={classifyItems(data.steps)} locale={locale} m={m} />
          <div className="flex flex-wrap gap-2">
            <Link href={`/${locale}/states/`} className="rounded-full border border-ink/30 px-4 py-2 text-sm font-medium text-ink hover:border-ink">
              {m.states.others}
            </Link>
            <button type="button" onClick={back} className="px-2 py-2 text-sm text-ink-soft underline underline-offset-2">
              {m.legacy.backToJourney}
            </button>
          </div>
        </div>
      )}
    />
  );
}

function StageContent({
  step,
  data,
  locale,
  m,
  here,
  onPlace,
}: {
  step: StateSimStep;
  data: StateSimulationData;
  locale: Locale;
  m: Messages;
  here: { href: string; label: string };
  onPlace: (id: string) => void;
}) {
  const { stage } = step;
  const reigns = reignsAt(step.polityId, step.year, data.political.reigns);
  const polity = data.political.polities.find((p) => p.id === step.polityId);
  const capital = stage.capitalId ? data.landmarks.find((p) => p.id === stage.capitalId) : undefined;
  const facts = stage.keyFacts;
  const factRows = (
    [
      ["area", facts?.area],
      ["population", facts?.population],
      ["army", facts?.army],
      ["economy", facts?.economy],
      ["religion", facts?.religion],
      ["languages", facts?.languages],
    ] as const
  ).filter(([, v]) => v);

  return (
    <article className="flex flex-col gap-4">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-medium tracking-wide text-parchment-light uppercase"
            style={{ background: "var(--mood-accent, var(--color-ink))" }}
          >
            <EventIcon type={step.icon} size={13} />
            {m.mood[step.mood]}
          </span>
          <span className="font-medium text-ink-soft">{formatDate(stage.date, m)}</span>
          <CertaintyBadge certainty={stage.date.certainty} m={m} />
          {step.claimType !== "fact" && <ClaimBadge type={step.claimType} locale={locale} m={m} size="xs" />}
        </div>
        <h2 className="mt-3 font-display text-[1.7rem] leading-tight font-semibold text-ink sm:text-3xl">{t(stage.title, locale)}</h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          <strong className="font-semibold text-ink">{t(stage.location.name, locale)}</strong>
          {capital && (
            <>
              {" · "}
              {m.polity.capital}: {t(capital.names.historical, locale)}
            </>
          )}
        </p>
      </header>

      {reigns.length > 0 && polity && (
        <p className="rounded-md border border-ink/10 bg-parchment/50 px-3 py-2 text-sm text-ink">
          <span className="text-ink-faint">{t(polity.name, locale)} · {m.polity.ruler}: </span>
          {reigns
            .map((r) => {
              const ruler = data.political.rulers.find((x) => x.id === r.rulerId);
              return `${ruler ? t(ruler.name, locale) : r.rulerId} (${formatReign(r)})`;
            })
            .join(", ")}
        </p>
      )}

      <StepClaimNotice type={step.claimType} locale={locale} m={m}>
        <p className="leading-relaxed text-ink">
          <GlossaryText text={t(stage.summary, locale)} />
        </p>
      </StepClaimNotice>

      {!!stage.events?.length && (
        <ol className="space-y-1.5 border-l-2 border-gold/50 pl-3 text-sm">
          {stage.events.map((e, i) => (
            <li key={i}>
              <span className="font-semibold text-ink tabular-nums">{e.date}</span> <span className="text-ink-soft">· {t(e.text, locale)}</span>
            </li>
          ))}
        </ol>
      )}

      {factRows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-ink/[0.04] p-3 text-sm">
          {factRows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-faint">{m.states.facts[k]}</dt>
              <dd className="text-ink">{t(v!, locale)}</dd>
            </div>
          ))}
        </dl>
      )}

      <ClaimList claims={step.claims} locale={locale} m={m} />

      <RelatedLinks refs={step.related} locale={locale} m={m} here={here} onPlace={onPlace} />

      <div>
        <p className="text-xs font-semibold tracking-wide text-ink uppercase">{m.sim.sources}</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-ink-soft marker:text-ink-faint">
          {stage.sources.map((s, i) => (
            <li key={i}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer" className="text-lapis underline decoration-lapis/30 underline-offset-2">
                  {s.title}
                </a>
              ) : (
                <span className="italic">{s.title}</span>
              )}
              {s.author && <span>, {s.author}</span>}
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}
