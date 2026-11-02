"use client";

import type { Locale } from "@/domain/schema";
import type { PoliticalContext } from "@/features/engine/types";
import { t, type Messages } from "@/lib/i18n";
import { formatReign } from "@/lib/rulers";

interface Props {
  political: PoliticalContext;
  /** Polities whose rulers make up the strip, in order (e.g. Səfəvilər → Əfşarlar). */
  polityIds: string[];
  from: number;
  to: number;
  year: number;
  locale: Locale;
  m: Messages;
}

/**
 * Rulers as a band on a true year scale under the timeline, with a marker on
 * the current year. Built from the reign table, so it stays correct when
 * reigns are added or corrected.
 */
export function DynastyStrip({ political, polityIds, from, to, year, locale, m }: Props) {
  const span = Math.max(1, to - from);
  const pct = (y: number) => `${((Math.min(Math.max(y, from), to) - from) / span) * 100}%`;
  const segments = political.reigns
    .filter((r) => polityIds.includes(r.polityId) && r.end.year >= from && r.start.year <= to)
    .sort((a, b) => a.start.year - b.start.year);
  if (segments.length === 0) return null;
  const color = (id: string) => political.polities.find((p) => p.id === id)?.color ?? "#8a7457";

  return (
    <div className="mx-6 mt-2" aria-label={m.states.dynasty} role="group" data-testid="dynasty-strip">
      <p className="mb-0.5 text-[10px] tracking-widest text-ink-faint uppercase">{m.states.dynasty}</p>
      <div className="relative h-6 overflow-hidden rounded-sm bg-ink/5">
        {segments.map((r) => {
          const ruler = political.rulers.find((x) => x.id === r.rulerId);
          const name = ruler ? t(ruler.name, locale) : r.rulerId;
          const current = r.start.year <= year && year <= r.end.year;
          const width = ((Math.min(r.end.year, to) - Math.max(r.start.year, from)) / span) * 100;
          return (
            <div
              key={`${r.rulerId}-${r.start.year}`}
              title={`${name} · ${formatReign(r)}`}
              className={`absolute inset-y-0 flex items-center overflow-hidden border-r border-parchment-light px-1 text-[10px] leading-none whitespace-nowrap ${current ? "font-semibold text-parchment-light" : "text-ink"}`}
              style={{
                left: pct(r.start.year),
                width: `${Math.max(width, 0.6)}%`,
                background: color(r.polityId),
                opacity: current ? 1 : 0.45,
              }}
            >
              {width > 7 ? name : ""}
            </div>
          );
        })}
        <div aria-hidden className="absolute inset-y-0 w-0.5 bg-carmine transition-[left] duration-700" style={{ left: pct(year) }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-ink-faint tabular-nums">
        <span>{from}</span>
        <span>{to}</span>
      </div>
    </div>
  );
}
