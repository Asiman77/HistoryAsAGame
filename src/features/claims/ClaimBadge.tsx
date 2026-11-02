"use client";

import { useId, useState } from "react";
import type { ClaimType, LocalizedText, Locale } from "@/domain/schema";
import { CLAIM_STYLE } from "@/lib/claims";
import { t, type Messages } from "@/lib/i18n";

/** Small glyphs: a seal for fact, scales for disputed, a scroll for legend, a quill for literary text. */
export function ClaimIcon({ type, size = 12 }: { type: ClaimType; size?: number }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      {type === "fact" && (
        <>
          <circle cx="12" cy="11" r="7" {...s} />
          <path d="M8.8 11.2l2.2 2.2 4.2-4.6M9 17.5L7.5 22 12 20l4.5 2-1.5-4.5" {...s} />
        </>
      )}
      {type === "disputed" && <path d="M12 3v18M7 21h10M4 7h16M4 7l-2.5 6a2.8 2.8 0 0 0 5 0zM20 7l-2.5 6a2.8 2.8 0 0 0 5 0z" {...s} />}
      {type === "legend" && <path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v1h4M10 9h6M10 13h6" {...s} />}
      {type === "literary" && <path d="M20 4C12 5 7 10 5 18l-1 3M20 4c-1 6-5 10-11 11M9 15l-4 3" {...s} />}
    </svg>
  );
}

/**
 * Coloured badge with icon and label. Hover, focus or tap opens a short
 * explanation: "Bu niyə rəvayət sayılır?" plus the reason given in the data.
 */
export function ClaimBadge({
  type,
  why,
  locale,
  m,
  size = "sm",
}: {
  type: ClaimType;
  why?: LocalizedText | undefined;
  locale: Locale;
  m: Messages;
  size?: "sm" | "xs";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const c = CLAIM_STYLE[type];
  return (
    <span className="group relative inline-flex" data-claim-type={type}>
      <button
        type="button"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className={`inline-flex cursor-help items-center gap-1 rounded-full border font-semibold tracking-wide uppercase ${size === "xs" ? "px-1.5 py-px text-[10px]" : "px-2.5 py-0.5 text-[11px]"}`}
        style={{ color: c.fg, background: c.bg, borderColor: c.border }}
        data-testid="claim-badge"
      >
        <ClaimIcon type={type} size={size === "xs" ? 11 : 12} />
        {m.claims.types[type]}
      </button>
      <span
        role="tooltip"
        id={id}
        className={`absolute top-full left-0 z-40 mt-1.5 w-64 rounded-md border bg-parchment-light p-3 text-left text-xs leading-snug font-normal tracking-normal normal-case shadow-lg transition-opacity ${open ? "visible opacity-100" : "invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"}`}
        style={{ borderColor: c.border }}
      >
        <span className="block font-semibold" style={{ color: c.fg }}>
          {m.claims.why[type]}
        </span>
        <span className="mt-1 block text-ink-soft">{why ? t(why, locale) : m.claims.help[type]}</span>
      </span>
    </span>
  );
}
