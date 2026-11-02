"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Locale, Place, TerritorySnapshotMeta } from "@/domain/schema";
import type { EngineStep, PoliticalContext } from "@/features/engine/types";
import { withBasePath } from "@/lib/basePath";
import { format, t, type Messages } from "@/lib/i18n";
import { placeNameIn } from "@/lib/places";
import { factsAt, formatReign, polityExistsIn, reignsAt } from "@/lib/rulers";
import { loadSnapshot } from "./territories";

interface Props {
  polityId: string;
  /** Year of the current step: the panel always describes this moment. */
  year: number;
  step: EngineStep | null;
  snapshot: TerritorySnapshotMeta | null;
  political: PoliticalContext;
  landmarks: Place[];
  /** Person whose simulation is open, to say "you rule this state". */
  currentPersonHref: string | null;
  locale: Locale;
  m: Messages;
  onFollow: (href: string) => void;
  onClose: () => void;
}

const STATUS_TONE: Record<string, string> = {
  rise: "bg-turquoise/15 text-turquoise",
  peak: "bg-gold/25 text-[#7a5a17]",
  stable: "bg-lapis/10 text-lapis",
  war: "bg-carmine/12 text-carmine",
  crisis: "bg-carmine/12 text-carmine",
  decline: "bg-ink/10 text-ink-soft",
};

/**
 * Click on a state on the map: who rules it in the current year, its capital,
 * situation, religion and languages, rivals and allies, and how it relates to
 * the story on screen. Everything is computed from the Reign table by year.
 */
export function PolityPanel({ polityId, year, step, snapshot, political, landmarks, currentPersonHref, locale, m, onFollow, onClose }: Props) {
  const reduced = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [area, setArea] = useState<{ id: string; km2: number } | null>(null);
  const polity = political.polities.find((p) => p.id === polityId);
  const meta = snapshot?.polities.find((p) => p.id === polityId);
  const name = meta ? t(meta.name, locale) : polity ? t(polity.name, locale) : polityId;
  const reigns = reignsAt(polityId, year, political.reigns);
  const facts = polity ? factsAt(polity, year) : null;
  const exists = polity ? polityExistsIn(polity, year) : true;
  const capital = meta?.capitalId ? landmarks.find((p) => p.id === meta.capitalId) : undefined;
  const overlord = meta?.vassalOf ? political.polities.find((p) => p.id === meta.vassalOf) : undefined;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, polityId]);

  // Area of the drawn polygon, from the snapshot already loaded for the map.
  useEffect(() => {
    if (!snapshot) return;
    let live = true;
    loadSnapshot(snapshot.id)
      .then((s) => {
        const km2 = s.polities.find((p) => p.id === polityId)?.areaKm2;
        if (live && km2) setArea({ id: `${snapshot.id}:${polityId}`, km2 });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [snapshot, polityId]);
  const areaKm2 = area?.id === `${snapshot?.id}:${polityId}` ? area.km2 : null;

  // How this state relates to what is happening in the story right now.
  const links: string[] = [];
  if (step?.battle) {
    if (step.battle.ownPolityId === polityId) links.push(format(m.polity.ownSide, { side: t(step.battle.ownSide, locale) }));
    if (step.battle.enemyPolityId === polityId) links.push(format(m.polity.enemySide, { side: t(step.battle.enemySide, locale) }));
  }
  const stateRef = step?.related.find((r) => r.type === "state" && (r.id === polityId || r.id === polity?.state?.id));
  if (stateRef?.note) links.push(t(stateRef.note, locale));
  const rulerPersons = reigns.map((r) => political.rulers.find((x) => x.id === r.rulerId)).filter((r) => r?.personHref);
  if (currentPersonHref && rulerPersons.some((r) => r!.personHref === currentPersonHref)) links.unshift(m.polity.youRule);

  const polityName = (id: string) => {
    const p = political.polities.find((x) => x.id === id);
    return p ? t(p.name, locale) : id;
  };
  const noData = !facts && reigns.length === 0;

  return (
    <motion.section
      role="dialog"
      aria-modal="false"
      aria-labelledby="polity-panel-title"
      data-testid="polity-panel"
      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="paper-card miniature-frame pointer-events-auto max-h-[calc(100vh-14rem)] w-[min(23rem,calc(100vw-2rem))] overflow-y-auto rounded-lg p-5"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1.5 size-4 shrink-0 rounded-sm border border-ink/30" style={{ background: polity?.color ?? meta?.color }} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-widest text-ink-faint uppercase">
            {m.polity.kicker} · {year}
          </p>
          <h2 id="polity-panel-title" className="font-display text-2xl leading-tight font-semibold text-ink">
            {name}
          </h2>
          {overlord && <p className="text-xs text-ink-soft">{format(m.polity.vassalOf, { name: t(overlord.name, locale) })}</p>}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={m.map.close}
          className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink"
        >
          ✕
        </button>
      </div>

      {!exists && <p className="mt-3 text-sm text-ink-soft">{m.polity.notExisting}</p>}

      {reigns.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label={m.polity.ruler}>
          {reigns.map((rg) => {
            const r = political.rulers.find((x) => x.id === rg.rulerId);
            if (!r) return null;
            return (
              <li key={`${rg.rulerId}-${rg.start.year}`} className="flex items-center gap-3 rounded-md border border-ink/10 bg-parchment/50 p-2.5">
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={withBasePath(r.image.src)} alt="" className="size-14 shrink-0 rounded-full border-2 border-gold/70 object-cover object-top" />
                ) : (
                  <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-gold/50 bg-parchment-dark font-display text-xl text-ink-soft">
                    {t(r.name, locale).replace(/^[IVX]+\s/, "")[0]}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] tracking-wider text-ink-faint uppercase">{m.polity.ruler}</p>
                  <p className="font-display text-lg leading-tight font-semibold text-ink">{t(r.name, locale)}</p>
                  <p className="text-xs text-ink-soft">
                    {r.titles.map((x) => t(x, locale)).join(", ")} · {formatReign(rg)}
                    {rg.certainty !== "exact" && <span className="text-ink-faint"> ({m.sim.certainty[rg.certainty].toLowerCase()})</span>}
                  </p>
                  {r.dynasty && <p className="text-xs text-ink-faint">{format(m.polity.dynasty, { name: t(r.dynasty, locale) })}</p>}
                  {r.personHref && r.personHref !== currentPersonHref && (
                    <button type="button" onClick={() => onFollow(r.personHref!)} className="mt-0.5 text-xs font-medium text-lapis underline underline-offset-2">
                      {m.polity.openPerson} →
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {links.length > 0 && (
        <div className="mt-3 rounded-md border border-gold/50 bg-gold/10 p-2.5 text-sm text-ink">
          {links.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}

      {facts && (
        <p className="mt-3 text-sm leading-relaxed text-ink">
          <span className={`mr-1.5 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold uppercase ${STATUS_TONE[facts.status]}`}>
            {m.polity.status[facts.status]}
          </span>
          {t(facts.statusNote, locale)}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        {capital && (
          <>
            <dt className="text-ink-faint">{m.polity.capital}</dt>
            <dd className="text-ink">{t(placeNameIn(capital, year), locale)}</dd>
          </>
        )}
        {areaKm2 && (
          <>
            <dt className="text-ink-faint">{m.polity.area}</dt>
            <dd className="text-ink" title={m.polity.areaHelp}>
              ~{(areaKm2 / 1000).toLocaleString("az")} min km² <span className="text-[11px] text-ink-faint">({m.polity.areaNote})</span>
            </dd>
          </>
        )}
        {facts?.religion && (
          <>
            <dt className="text-ink-faint">{m.polity.religion}</dt>
            <dd className="text-ink">{t(facts.religion, locale)}</dd>
          </>
        )}
        {facts?.languages && (
          <>
            <dt className="text-ink-faint">{m.polity.languages}</dt>
            <dd className="text-ink">{t(facts.languages, locale)}</dd>
          </>
        )}
        {!!facts?.rivals?.length && (
          <>
            <dt className="text-ink-faint">{m.polity.rivals}</dt>
            <dd className="text-ink">{facts.rivals.map(polityName).join(", ")}</dd>
          </>
        )}
        {!!facts?.allies?.length && (
          <>
            <dt className="text-ink-faint">{m.polity.allies}</dt>
            <dd className="text-ink">{facts.allies.map(polityName).join(", ")}</dd>
          </>
        )}
      </dl>

      {noData && <p className="mt-3 rounded-md bg-ink/5 p-2.5 text-sm text-ink-soft">{m.polity.soon}</p>}

      {polity?.state &&
        (polity.state.href ? (
          <Link href={`/${locale}${polity.state.href}`} className="btn-primary mt-4 block text-center text-sm">
            {m.polity.openState} →
          </Link>
        ) : (
          <p className="mt-4 rounded-full border border-dashed border-ink/25 px-3 py-1.5 text-center text-xs text-ink-faint">
            {m.polity.openState} · {m.related.soon}
          </p>
        ))}

      {(facts?.sources.length || reigns.length > 0) && (
        <p className="mt-3 text-[10px] text-ink-faint">
          {m.sim.sources}:{" "}
          {[...(facts?.sources ?? []), ...reigns.flatMap((rg) => political.rulers.find((r) => r.id === rg.rulerId)?.sources ?? [])]
            .filter((s, i, all) => all.findIndex((x) => x.title === s.title) === i)
            .map((s, i) => (
              <span key={s.title}>
                {i > 0 && ", "}
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
              </span>
            ))}
        </p>
      )}
    </motion.section>
  );
}
