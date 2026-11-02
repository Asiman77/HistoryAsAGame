"use client";

import { DividerGlyph } from "@/features/theme/ornaments";
import { useTheme } from "@/features/theme/ThemeShell";

/** Eight-pointed star (khatam) used as a decorative divider and mark. */
export function Star({ className = "", size = 18 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <path
        d="M12 1.5l2.6 4.2 4.8-1.1-1.1 4.8 4.2 2.6-4.2 2.6 1.1 4.8-4.8-1.1L12 22.5l-2.6-4.2-4.8 1.1 1.1-4.8L1.5 12l4.2-2.6-1.1-4.8 4.8 1.1z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="3.2" fill="var(--color-parchment-light)" />
    </svg>
  );
}

/** Gold rule with the period's mark in the middle (data/themes: ornaments.divider). */
export function Divider({ className = "" }: { className?: string }) {
  const kind = useTheme()?.theme.ornaments.divider ?? "star";
  return (
    <div className={`flex items-center gap-3 text-gold ${className}`} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/60 to-gold/80" />
      <DividerGlyph kind={kind} size={14} />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/60 to-gold/80" />
    </div>
  );
}
