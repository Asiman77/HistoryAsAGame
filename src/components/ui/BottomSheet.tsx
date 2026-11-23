"use client";

import { useRef, useState } from "react";
import { cx } from "@/lib/cx";

export type SheetSnap = "peek" | "half" | "full";

/** Height of a snap state in px for a viewport of `vh` px. */
export const sheetHeight = (snap: SheetSnap, vh: number) => (snap === "peek" ? 148 : snap === "half" ? Math.round(vh * 0.48) : Math.round(vh * 0.9));

export interface BottomSheetProps {
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  /** Viewport height in px (the sheet's heights follow it). */
  vh: number;
  label: string;
  expandLabel: string;
  collapseLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

const ORDER: SheetSnap[] = ["peek", "half", "full"];

/**
 * Mobile bottom sheet with three states (§5.4): peek, half, full. The handle
 * is a real button (tap: half ↔ full, from peek: half); dragging it snaps to
 * the nearest state. The footer (step navigation) is always visible.
 */
export function BottomSheet({ snap, onSnap, vh, label, expandLabel, collapseLabel, children, footer, className }: BottomSheetProps) {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const height = drag ?? sheetHeight(snap, vh);

  const nearest = (h: number): SheetSnap =>
    ORDER.reduce((best, s) => (Math.abs(sheetHeight(s, vh) - h) < Math.abs(sheetHeight(best, vh) - h) ? s : best), "half" as SheetSnap);

  return (
    <section
      aria-label={label}
      data-testid="bottom-sheet"
      data-snap={snap}
      className={cx(
        "fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[28px] border-t border-line bg-surface-panel shadow-deep",
        drag === null && "transition-[height] duration-300 ease-out",
        className,
      )}
      style={{ height }}
    >
      <button
        type="button"
        className="flex h-8 w-full shrink-0 touch-none items-center justify-center"
        aria-label={snap === "full" ? collapseLabel : expandLabel}
        aria-expanded={snap !== "peek"}
        onClick={() => {
          if (start.current?.moved) return;
          onSnap(snap === "full" ? "half" : snap === "half" ? "full" : "half");
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = { y: e.clientY, h: height, moved: false };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dy = s.y - e.clientY;
          if (Math.abs(dy) > 6) s.moved = true;
          if (s.moved) setDrag(Math.min(sheetHeight("full", vh), Math.max(sheetHeight("peek", vh), s.h + dy)));
        }}
        onPointerUp={() => {
          const s = start.current;
          if (s?.moved && drag !== null) onSnap(nearest(drag));
          setDrag(null);
          setTimeout(() => (start.current = null), 0);
        }}
      >
        <span aria-hidden className="h-1.5 w-12 rounded-full bg-fg/25" />
      </button>
      <div className={cx("min-h-0 flex-1 px-5", snap === "peek" ? "overflow-hidden" : "overflow-y-auto overscroll-contain")}>{children}</div>
      {footer ? <div className="shrink-0 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">{footer}</div> : null}
    </section>
  );
}
