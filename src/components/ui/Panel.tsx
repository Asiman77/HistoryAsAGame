import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

export interface PanelProps extends ComponentProps<"div"> {
  /** Thin gradient line on top in the period colours (story panel). */
  edge?: boolean;
}

/** Floating panel over the map or the page (§3.4: 16–20 px, deep soft shadow). */
export function Panel({ edge, className, children, ...rest }: PanelProps) {
  return (
    <div className={cx("relative overflow-hidden rounded-panel border border-line bg-surface-panel/92 shadow-deep backdrop-blur-md", className)} {...rest}>
      {edge ? (
        <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: "linear-gradient(90deg, var(--secondary), var(--accent), var(--secondary-2))" }} />
      ) : null}
      {children}
    </div>
  );
}
