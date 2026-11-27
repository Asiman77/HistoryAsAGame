"use client";

import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { loadSnapshot } from "@/features/map/territories";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { formatYear, formatYearOrdinal } from "@/lib/historicalDate";
import { capitalName, panelAt, type PanelPolitical } from "./data";

export interface RulerPanelProps {
  political: PanelPolitical;
  polityId: string;
  /** The moment the panel describes: the slider's year or the step's. */
  year: number;
  /** Snapshot drawn on the map for that year: capital, overlord, area. */
  snapshot: { id: string; polities: { id: string; name: string; capitalId?: string; vassalOf?: string }[] } | null;
  /** How the state relates to the story on screen ("you rule it", "the enemy"). */
  notes?: string[];
  /** Person simulation already open: its own "Həyatını yaşa" is not offered. */
  currentPersonHref?: string | null;
  onClose: () => void;
  className?: string;
}

/**
 * Hökmdar paneli (FRONTEND_SPEC §6.2, artboard "Zaman şkalası"): who rules
 * the clicked state in the year, the capital, the situation, rivals and
 * allies, and the way into the ruler's life and the state's simulation
 * (passive "tezliklə" when they are not built). Everything comes from the
 * reign table and the polity facts by year; without them it says so.
 */
export function RulerPanel({ political, polityId, year, snapshot, notes = [], currentPersonHref = null, onClose, className }: RulerPanelProps) {
  const t = useTranslations("rulerPanel");
  const reduced = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { polity, reigns, facts, exists, noData } = panelAt(political, polityId, year);
  const meta = snapshot?.polities.find((p) => p.id === polityId);
  const name = meta?.name ?? polity?.name ?? polityId;
  const capital = capitalName(meta?.capitalId ? political.capitals[meta.capitalId] : undefined, year);
  const overlord = meta?.vassalOf ? (political.polities[meta.vassalOf]?.name ?? meta.vassalOf) : null;
  const main = reigns[0] ? political.rulers[reigns[0].rulerId] : undefined;
  const color = polity?.color ?? "var(--secondary)";
  const [area, setArea] = useState<{ key: string; km2: number } | null>(null);
  const areaKey = `${snapshot?.id}:${polityId}`;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, polityId]);

  // Area of the drawn polygon, from the snapshot the map has loaded already.
  useEffect(() => {
    if (!snapshot) return;
    let live = true;
    loadSnapshot(snapshot.id)
      .then((s) => {
        const km2 = s.polities.find((p) => p.id === polityId)?.areaKm2;
        if (live && km2) setArea({ key: `${snapshot.id}:${polityId}`, km2 });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [snapshot, polityId]);

  const sources = [...(facts?.sources ?? []), ...reigns.flatMap((r) => political.rulers[r.rulerId]?.sources ?? [])].filter(
    (s, i, all) => all.findIndex((x) => x.title === s.title) === i,
  );
  const initial = (main?.name ?? name).replace(/^[IVX]+\s/, "").charAt(0);
  const reignText = (from: number, to: number) => (from === to ? t("reignOne", { year: formatYear(from) }) : t("reign", { from: formatYear(from), to: formatYear(to) }));

  return (
    <motion.section
      role="dialog"
      aria-modal="false"
      aria-labelledby="ruler-panel-title"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx("flex max-h-full flex-col overflow-hidden rounded-[20px] border border-line-strong bg-surface-panel/95 shadow-deep backdrop-blur-md", className)}
      data-testid="polity-panel"
      data-polity={polityId}
    >
      <div className="flex gap-4 p-5" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${color} 45%, transparent), transparent)` }}>
        {main?.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- static export
          <img src={main.image.src} alt={main.image.alt} className="h-[92px] w-[76px] shrink-0 rounded-button-lg border border-line-strong object-cover object-top" />
        ) : (
          <span
            aria-hidden
            className="grid h-[92px] w-[76px] shrink-0 place-items-center rounded-button-lg border border-line-strong font-heading text-34 text-fg/80"
            style={{ background: `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${color} 80%, transparent), var(--bg-panel))` }}
          >
            {initial}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="m-0 text-12 uppercase tracking-[0.16em] text-fg-secondary">{t("eyebrow", { polity: name, year: formatYearOrdinal(year) })}</p>
          <h2 id="ruler-panel-title" className="m-0 font-heading text-26 font-medium leading-tight text-fg" data-testid="ruler-name">
            {main?.name ?? name}
          </h2>
          {reigns[0] ? (
            <p className="m-0 text-13 text-fg-secondary">
              {reignText(reigns[0].from, reigns[0].to)}
              {reigns[0].certainty !== "exact" ? ` · ${t("approx")}` : ""}
            </p>
          ) : null}
          {overlord ? <p className="m-0 text-12 text-fg-muted">{t("vassalOf", { name: overlord })}</p> : null}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="-mr-2 -mt-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-fg-secondary hover:bg-fg/10 hover:text-fg"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 pb-5">
        {reigns.length > 1 ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-13 text-fg-secondary" aria-label={t("coRulers")}>
            {reigns.slice(1).map((r) => (
              <li key={`${r.rulerId}-${r.from}`}>
                <span className="text-fg">{political.rulers[r.rulerId]?.name ?? r.rulerId}</span> · {reignText(r.from, r.to)}
              </li>
            ))}
          </ul>
        ) : null}
        {notes.length ? (
          <div className="rounded-button-lg border border-line-strong bg-accent/10 px-3 py-2 text-13 text-fg">
            {notes.map((n) => (
              <p key={n} className="m-0">
                {n}
              </p>
            ))}
          </div>
        ) : null}
        {!exists ? <p className="m-0 text-14 text-fg-secondary">{t("notExisting")}</p> : null}

        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-14">
          {capital ? (
            <>
              <dt className="text-fg-muted">{t("capital")}</dt>
              <dd className="m-0 text-fg">{capital}</dd>
            </>
          ) : null}
          {facts ? (
            <>
              <dt className="text-fg-muted">{t("status")}</dt>
              <dd className="m-0 text-fg">{t(`statuses.${facts.status}`)}</dd>
            </>
          ) : null}
          {facts?.rivals.length ? (
            <>
              <dt className="text-fg-muted">{t("rivals")}</dt>
              <dd className="m-0 text-fg">{facts.rivals.join(", ")}</dd>
            </>
          ) : null}
          {facts?.allies.length ? (
            <>
              <dt className="text-fg-muted">{t("allies")}</dt>
              <dd className="m-0 text-fg">{facts.allies.join(", ")}</dd>
            </>
          ) : null}
          {facts?.religion ? (
            <>
              <dt className="text-fg-muted">{t("religion")}</dt>
              <dd className="m-0 text-fg">{facts.religion}</dd>
            </>
          ) : null}
          {facts?.languages ? (
            <>
              <dt className="text-fg-muted">{t("languages")}</dt>
              <dd className="m-0 text-fg">{facts.languages}</dd>
            </>
          ) : null}
          {area?.key === areaKey ? (
            <>
              <dt className="text-fg-muted">{t("area")}</dt>
              <dd className="m-0 text-fg" title={t("areaNote")}>
                {t("areaValue", { value: Math.round(area.km2 / 1000) })}
              </dd>
            </>
          ) : null}
        </dl>
        {facts ? <p className="m-0 text-14 leading-relaxed text-fg-secondary">{facts.statusNote}</p> : null}
        {noData ? (
          <p className="m-0 rounded-button-lg bg-fg/5 px-3 py-2 text-14 text-fg-secondary" data-testid="polity-no-data">
            {t("noData")}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          {main?.personHref && main.personHref !== currentPersonHref ? (
            <Link href={main.personHref} className={cx(buttonClass({ size: "md" }), "flex-1")} data-testid="ruler-live">
              {t("live")}
            </Link>
          ) : !main?.personHref ? (
            <span className="inline-flex min-h-11 flex-1 items-center justify-center rounded-button-lg border border-dashed border-fg/25 px-3 text-14 text-fg-muted">
              {t("liveSoon")}
            </span>
          ) : null}
          {polity?.state?.href ? (
            <Link href={polity.state.href} className={cx(buttonClass({ variant: "secondary", size: "md" }), "flex-1")} data-testid="ruler-state">
              {t("state")}
            </Link>
          ) : (
            <span className="inline-flex min-h-11 flex-1 items-center justify-center rounded-button-lg border border-dashed border-fg/25 px-3 text-14 text-fg-muted">
              {t("stateSoon")}
            </span>
          )}
        </div>

        {sources.length ? (
          <p className="m-0 text-12 text-fg-muted">
            {t("sources")}:{" "}
            {sources.map((s, i) => (
              <span key={s.title}>
                {i > 0 ? ", " : ""}
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </motion.section>
  );
}
