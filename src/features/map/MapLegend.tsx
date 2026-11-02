"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Locale, TerritorySnapshotMeta } from "@/domain/schema";
import { t, type Messages } from "@/lib/i18n";

interface Props {
  snapshot: TerritorySnapshotMeta | null;
  battle: { own: string; enemy: string; ownName: string; enemyName: string } | null;
  locale: Locale;
  m: Messages;
  defaultOpen: boolean;
  onSelectPolity?: (polityId: string) => void;
}

/** Which political map is shown, its polities, and that the borders are approximate. */
export function MapLegend({ snapshot, battle, locale, m, defaultOpen, onSelectPolity }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [help, setHelp] = useState(false);
  if (!snapshot) return null;

  return (
    <div className="paper-card pointer-events-auto max-w-[17rem] rounded-lg text-xs" data-testid="map-legend">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? m.map.hideLegend : m.map.showLegend}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[10px] tracking-widest text-ink-faint uppercase">
            {m.map.legendTitle} · {snapshot.year}
          </span>
          <span className="block truncate font-display text-sm font-semibold text-ink">{t(snapshot.title, locale)}</span>
        </span>
        <span aria-hidden className={`text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-[40vh] overflow-y-auto px-3 pb-3">
              {snapshot.certainty !== "exact" && (
              <button
                type="button"
                onClick={() => setHelp((h) => !h)}
                aria-expanded={help}
                className="mb-2 inline-flex items-center gap-1 rounded-sm bg-gold/20 px-1.5 py-0.5 font-medium text-[#7a5a17]"
              >
                ≈ {m.map.approxBorders} <span aria-hidden>ⓘ</span>
              </button>
              )}
              {help && <p className="mb-2 leading-snug text-ink-soft">{m.map.approxBordersHelp}</p>}
              {snapshot.note && <p className="mb-2 leading-snug text-ink-soft">{t(snapshot.note, locale)}</p>}
              <p className="mb-1 text-[10px] text-ink-faint">{m.polity.legendHint}</p>
              <ul className="space-y-1">
                {snapshot.polities.map((p) => (
                  <li key={`${p.id}-${t(p.name, locale)}`} className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-sm border border-ink/30"
                      style={{ background: p.color, opacity: p.vassalOf ? 0.55 : 0.85 }}
                    />
                    <button
                      type="button"
                      onClick={() => onSelectPolity?.(p.id)}
                      className="text-left text-ink underline-offset-2 hover:underline"
                    >
                      {t(p.name, locale)}
                      {p.vassalOf && <span className="text-ink-faint"> ({m.map.vassal})</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-ink-faint">
                {m.map.snapshotSources}:{" "}
                {snapshot.sources.map((s, i) => (
                  <span key={i}>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {battle && (
        <div className="border-t border-ink/10 px-3 py-2">
          <p className="mb-1 text-[10px] leading-snug text-ink-faint">{m.map.battleSchematic}</p>
          <p className="flex items-center gap-2">
            <span aria-hidden className="h-1 w-5 rounded" style={{ background: battle.own }} />
            <span className="text-ink">{battle.ownName}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-2">
            <span aria-hidden className="h-1 w-5 rounded" style={{ background: battle.enemy }} />
            <span className="text-ink">{battle.enemyName}</span>
          </p>
        </div>
      )}
    </div>
  );
}
