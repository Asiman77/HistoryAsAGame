"use client";

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GlossaryEntry, Locale } from "@/domain/schema";
import { tokenizeGlossary } from "@/lib/glossary";
import { t } from "@/lib/i18n";

interface GlossaryContextValue {
  entries: GlossaryEntry[];
  locale: Locale;
  label: string;
}

const GlossaryContext = createContext<GlossaryContextValue>({ entries: [], locale: "az", label: "" });

export function GlossaryProvider({ children, ...value }: GlossaryContextValue & { children: React.ReactNode }) {
  const memo = useMemo(() => value, [value.entries, value.locale, value.label]); // eslint-disable-line react-hooks/exhaustive-deps
  return <GlossaryContext.Provider value={memo}>{children}</GlossaryContext.Provider>;
}

/** Plain text with glossary terms marked; hovering, focusing or tapping a term shows its definition. */
export function GlossaryText({ text }: { text: string }) {
  const { entries } = useContext(GlossaryContext);
  const segments = useMemo(() => tokenizeGlossary(text, entries), [text, entries]);
  return (
    <>
      {segments.map((s, i) =>
        s.termId ? <Term key={i} text={s.text} entry={entries.find((e) => e.id === s.termId)!} /> : s.text,
      )}
    </>
  );
}

function Term({ text, entry }: { text: string; entry: GlossaryEntry }) {
  const { locale, label } = useContext(GlossaryContext);
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const id = useId();

  const open = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(288, window.innerWidth - 24);
    const x = Math.min(Math.max(12, r.left + r.width / 2 - width / 2), window.innerWidth - width - 12);
    const above = r.bottom + 170 > window.innerHeight;
    setPos({ x, y: above ? r.top - 8 : r.bottom + 8, above });
  };
  const close = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="glossary-term"
        aria-describedby={pos ? id : undefined}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        // Focus or hover has usually opened it already; a tap keeps it open until blur.
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
      >
        {text}
      </button>
      {pos &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="paper-card pointer-events-none fixed z-50 block rounded-md px-3 py-2 text-left text-sm leading-snug font-normal text-ink not-italic"
            style={{
              left: pos.x,
              top: pos.y,
              width: Math.min(288, window.innerWidth - 24),
              transform: pos.above ? "translateY(-100%)" : undefined,
            }}
          >
            <span className="block text-[10px] font-semibold tracking-wider text-ink-faint uppercase">{label}</span>
            <span className="block font-display text-base font-semibold">{t(entry.term, locale)}</span>
            <span className="mt-0.5 block text-ink-soft">{t(entry.definition, locale)}</span>
          </span>,
          document.body,
        )}
    </>
  );
}
