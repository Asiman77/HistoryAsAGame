"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import type { TimelinePreviewData } from "./data";

const MAX_CHIPS = 3;

/**
 * "İli seç, dünyanı gör": a native range input over the era bands (keyboard
 * and screen readers work out of the box), the rulers of the chosen year and
 * a link that opens the full timeline on that year.
 */
export function TimelinePreview({ data, initialYear }: { data: TimelinePreviewData; initialYear: number }) {
  const t = useTranslations("home.timeline");
  const [year, setYear] = useState(initialYear);
  const id = useId();
  const span = data.to - data.from;
  const pct = (y: number) => ((y - data.from) / span) * 100;
  const rulers = useMemo(() => data.reigns.filter((r) => r.from <= year && r.to >= year), [data.reigns, year]);
  // Era names that fit: wide enough and clear of the year labels at both ends.
  const labelled = data.eras.filter((e) => e.name && e.to - e.from > span * 0.06 && pct((e.from + e.to) / 2) > 9 && pct((e.from + e.to) / 2) < 91);

  return (
    <Card padding="lg" className="flex h-full flex-col gap-6" data-testid="timeline-preview">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h2 className="m-0 font-heading text-30 font-medium text-fg">{t("title")}</h2>
        </div>
        <output htmlFor={id} className="font-heading text-60 font-medium leading-none text-accent tabular-nums" data-testid="preview-year">
          {year}
        </output>
      </div>

      <div className="relative pt-1">
        <div aria-hidden className="relative h-1.5 overflow-hidden rounded-full bg-fg/12">
          {data.eras.map((e) =>
            e.color ? <span key={e.from} className="absolute inset-y-0" style={{ left: `${pct(e.from)}%`, width: `${pct(e.to + 1) - pct(e.from)}%`, background: e.color }} /> : null,
          )}
        </div>
        <input
          id={id}
          type="range"
          min={data.from}
          max={data.to}
          step={1}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          aria-label={t("slider")}
          className="ds-range absolute inset-x-0 -top-2.5 h-7 w-full cursor-pointer appearance-none bg-transparent"
        />
        <div aria-hidden className="relative mt-3 h-4 text-12 text-fg-muted">
          <span className="absolute left-0">{data.from}</span>
          {labelled.map((e) => (
            <span key={e.from} className="absolute hidden -translate-x-1/2 whitespace-nowrap md:inline" style={{ left: `${pct((e.from + e.to) / 2)}%` }}>
              {e.name}
            </span>
          ))}
          <span className="absolute right-0">{data.to}</span>
        </div>
      </div>

      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-live="polite" data-testid="preview-rulers">
        {rulers.slice(0, MAX_CHIPS).map((r) => (
          <li key={`${r.polity}-${r.ruler}`} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-fg/15 bg-surface/60 px-3 text-13 text-fg">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: r.color }} />
            {r.polity} · {r.ruler}
          </li>
        ))}
        {rulers.length > MAX_CHIPS ? (
          <li className="inline-flex min-h-9 items-center rounded-full border border-fg/15 px-3 text-13 text-fg-secondary">+{rulers.length - MAX_CHIPS}</li>
        ) : null}
      </ul>

      <Link href={`${ROUTES.timeline}?year=${year}`} className="mt-auto text-14 font-semibold text-accent hover:text-accent-hover" data-testid="preview-open">
        {t("open")} <span aria-hidden>→</span>
      </Link>
    </Card>
  );
}
