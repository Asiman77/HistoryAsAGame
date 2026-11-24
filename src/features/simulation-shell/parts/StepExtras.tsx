"use client";

import { Globe2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ClaimBadge } from "@/components/claims/ClaimBadge";
import { cx } from "@/lib/cx";
import type { ShellBattle, ShellClaim, ShellMore, ShellSource } from "../types";

export function SourceLine({ s }: { s: ShellSource }) {
  return (
    <>
      {s.url ? (
        <a href={s.url} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
          {s.title}
        </a>
      ) : (
        <span className="italic">{s.title}</span>
      )}
      {s.author ? `, ${s.author}` : ""}
      {s.note ? <span className="text-fg-muted"> ({s.note})</span> : null}
    </>
  );
}

function SourceList({ sources }: { sources: ShellSource[] }) {
  return (
    <>
      {sources.map((s, i) => (
        <span key={`${s.title}-${i}`}>
          {i > 0 ? "; " : ""}
          <SourceLine s={s} />
        </span>
      ))}
    </>
  );
}

const RESULT_TONE: Record<ShellBattle["result"], string> = {
  victory: "border-claim-fact text-claim-fact",
  defeat: "border-negative text-negative",
  inconclusive: "border-claim-disputed text-claim-disputed",
};

/** Result card of a battle step: sides, commanders, forces with their source, the result stamp and why it mattered. */
export function BattleCard({ battle }: { battle: ShellBattle }) {
  const t = useTranslations("shell.battle");
  const side = (who: "own" | "enemy") => (
    <div className="min-w-0">
      <p className="m-0 text-12 uppercase tracking-[0.14em] text-fg-muted">{t(who)}</p>
      <p className="m-0 mt-1 font-heading text-16 leading-tight text-fg">{who === "own" ? battle.own : battle.enemy}</p>
      {battle.commanders[who].length ? (
        <ul className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0 text-13 text-fg-secondary" aria-label={t("commanders")}>
          {battle.commanders[who].map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
      {battle.forces[who] ? (
        <p className="m-0 mt-1.5 text-13 text-fg">
          <span className="text-fg-muted">{t("forces")}: </span>
          {battle.forces[who]}
        </p>
      ) : null}
    </div>
  );
  return (
    <section className="flex flex-col gap-4 rounded-panel border border-line bg-surface/40 p-5" aria-label={t("label")} data-testid="battle-card">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        {side("own")}
        <span className="pt-5 font-heading text-14 italic text-fg-muted">{t("vs")}</span>
        {side("enemy")}
      </div>
      {battle.forcesSource ? (
        <p className="m-0 text-12 text-fg-muted">
          {t("forcesNote")} {t("source")}: <SourceLine s={battle.forcesSource} />
        </p>
      ) : null}
      <div className="flex items-start gap-3">
        <span className={cx("shrink-0 -rotate-6 rounded-button border-2 px-2.5 py-1 font-heading text-14 font-bold uppercase tracking-widest", RESULT_TONE[battle.result])} data-testid="battle-result">
          {t(`result.${battle.result}`)}
        </span>
        <p className="m-0 text-14 leading-relaxed text-fg-secondary">
          <span className="block text-12 font-semibold uppercase tracking-[0.14em] text-fg">{t("significance")}</span>
          {battle.context}
        </p>
      </div>
    </section>
  );
}

function ClaimItem({ claim, showVersions = true }: { claim: ShellClaim; showVersions?: boolean }) {
  const t = useTranslations("shell.claims");
  return (
    <li className="flex flex-col gap-1.5 rounded-panel border border-line bg-surface/30 p-4" data-claim-id={claim.id}>
      <ClaimBadge type={claim.type} {...(claim.why ? { why: claim.why } : {})} className="self-start" />
      <p className="m-0 text-14 leading-relaxed text-fg">{claim.text}</p>
      {claim.why ? <p className="m-0 text-13 text-fg-secondary">{claim.why}</p> : null}
      {showVersions && claim.versions.length ? (
        <div>
          <p className="m-0 text-12 font-semibold uppercase tracking-[0.14em] text-fg-muted">{t("versionsList")}</p>
          <ol className="m-0 mt-1 flex flex-col gap-1 pl-5 text-13 text-fg-secondary">
            {claim.versions.map((v, i) => (
              <li key={i}>
                {v.text}{" "}
                <span className="text-fg-muted">
                  (<SourceList sources={v.sources} />)
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {claim.firstRecorded ? (
        <p className="m-0 text-13 text-fg-secondary">
          <span className="font-semibold text-fg">{t("firstRecorded")}:</span> <SourceLine s={claim.firstRecorded.source} />
          {claim.firstRecorded.year ? ` (${claim.firstRecorded.year})` : ""}
          {claim.firstRecorded.note ? <span className="block text-fg-muted">{claim.firstRecorded.note}</span> : null}
        </p>
      ) : null}
      {claim.sources.length ? (
        <p className="m-0 text-12 text-fg-muted">
          {t("sources")}: <SourceList sources={claim.sources} />
        </p>
      ) : null}
    </li>
  );
}

/** "Alternativ versiya" (§5.5): disputed statements of the step with their competing versions, open by default. */
export function AlternativeVersions({ claims }: { claims: ShellClaim[] }) {
  const t = useTranslations("shell.claims");
  if (!claims.length) return null;
  return (
    <details open className="rounded-panel border border-claim-disputed/40 px-4 py-3" data-testid="alt-versions">
      <summary className="cursor-pointer text-14 font-semibold text-claim-disputed">{t("versions")}</summary>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
        {claims.map((c) => (
          <ClaimItem key={c.id} claim={c} />
        ))}
      </ul>
    </details>
  );
}

/** Facts and legends of the step; legends fold away when the reader turned them off, and open on demand. */
function ClaimList({ claims, legends }: { claims: ShellClaim[]; legends: boolean }) {
  const t = useTranslations("shell.claims");
  const [revealed, setRevealed] = useState(false);
  const hidden = !legends && !revealed ? claims.filter((c) => c.type === "legend") : [];
  const shown = claims.filter((c) => !hidden.includes(c));
  return (
    <div className="flex flex-col gap-2.5" data-testid="claim-list">
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {shown.map((c) => (
          <ClaimItem key={c.id} claim={c} />
        ))}
      </ul>
      {hidden.length ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="min-h-9 self-start rounded-full border border-claim-legend/45 px-3 text-13 font-semibold text-claim-legend"
          data-testid="show-hidden-legends"
        >
          {t("hiddenLegends", { n: hidden.length })} · {t("show")}
        </button>
      ) : null}
    </div>
  );
}

function Block({ title, children, testId }: { title: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      <h3 className="m-0 text-12 font-semibold uppercase tracking-[0.14em] text-eyebrow">{title}</h3>
      {children}
    </section>
  );
}

export interface MoreSectionProps {
  more: ShellMore;
  /** Facts and legends; disputed ones are shown above as alternative versions. */
  claims: ShellClaim[];
  year: number;
  legends: boolean;
  /** Learning mode opens the section. */
  open: boolean;
}

/** True when the "Ətraflı" section would have anything to show. */
export const hasMore = (more: ShellMore, claims: ShellClaim[]) =>
  !!more.date || !!more.primary || more.terms.length > 0 || more.world.length > 0 || claims.length > 0;

/**
 * "Ətraflı" (Q6): what the legacy panel had besides the main story, folded
 * by default so the design's composition stays: date details, facts and
 * legends, the primary source excerpt, glossary terms, and what happened in
 * the world around the same year.
 */
export function MoreSection({ more, claims, year, legends, open }: MoreSectionProps) {
  const t = useTranslations("shell.more");
  if (!hasMore(more, claims)) return null;
  return (
    <details open={open} className="group rounded-panel border border-line px-4 py-3" data-testid="more">
      <summary className="cursor-pointer text-14 font-semibold text-fg">{t("title")}</summary>
      <div className="mt-4 flex flex-col gap-5">
        {more.date ? (
          <Block title={t("date")} testId="more-date">
            <p className="m-0 text-14 text-fg-secondary">{more.date.help}</p>
            {more.date.note ? <p className="m-0 text-14 text-fg-secondary">{more.date.note}</p> : null}
            {more.date.alternatives.length ? (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-14 text-fg-secondary">
                {more.date.alternatives.map((a) => (
                  <li key={a.date + a.note}>
                    <span className="font-semibold text-fg">{a.date}</span>: {a.note}
                  </li>
                ))}
              </ul>
            ) : null}
          </Block>
        ) : null}
        {claims.length ? (
          <Block title={t("claims")}>
            <ClaimList claims={claims} legends={legends} />
          </Block>
        ) : null}
        {more.primary ? (
          <Block title={t("primary")} testId="more-primary">
            <figure className="m-0 flex flex-col gap-2 rounded-panel border border-line bg-surface/30 p-4">
              {more.primary.original ? (
                <blockquote className="m-0 font-heading text-15 italic text-fg-secondary">
                  <span className="sr-only">{t("original")}: </span>
                  {more.primary.original}
                </blockquote>
              ) : null}
              <blockquote className="m-0 font-heading text-16 leading-snug text-fg">
                {more.primary.original ? <span className="sr-only">{t("translation")}: </span> : null}“{more.primary.text}”
              </blockquote>
              {more.primary.note ? <p className="m-0 text-13 text-fg-secondary">{more.primary.note}</p> : null}
              <figcaption className="text-12 text-fg-muted">
                — {more.primary.attribution}
                {more.primary.translator ? ` · ${t("translator", { name: more.primary.translator })}` : ""} · {t("license", { license: more.primary.license })} ·{" "}
                <SourceLine s={more.primary.source} />
              </figcaption>
            </figure>
          </Block>
        ) : null}
        {more.terms.length ? (
          <Block title={t("terms")} testId="more-terms">
            <dl className="m-0 flex flex-col gap-2">
              {more.terms.map((g) => (
                <div key={g.id}>
                  <dt className="font-heading text-16 text-fg">{g.term}</dt>
                  <dd className="m-0 text-14 leading-relaxed text-fg-secondary">{g.definition}</dd>
                </div>
              ))}
            </dl>
          </Block>
        ) : null}
        {more.world.length ? (
          <Block
            title={
              <span className="inline-flex items-center gap-1.5">
                <Globe2 size={14} aria-hidden /> {t("world", { year })}
              </span>
            }
            testId="more-world"
          >
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {more.world.map((w) => (
                <li key={w.id} className="text-14">
                  <p className="m-0 flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-fg">
                      {w.years}: {w.title}
                    </span>
                    <span className="text-12 text-fg-muted">
                      {w.region} · {w.when}
                    </span>
                  </p>
                  <p className="m-0 mt-0.5 leading-snug text-fg-secondary">{w.description}</p>
                  {w.source?.url ? (
                    <a href={w.source.url} target="_blank" rel="noreferrer" className="text-12 text-accent underline-offset-2 hover:underline">
                      {w.source.title}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </Block>
        ) : null}
      </div>
    </details>
  );
}
