import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

export interface CardProps extends ComponentProps<"div"> {
  /** Radial light of the period's second colour, like the person cards of the home page. */
  tint?: boolean;
  /** Lift and glow on hover (cards that are links). */
  interactive?: boolean;
  padding?: "none" | "md" | "lg";
}

const PADDING = { none: "", md: "p-5", lg: "p-7" };

/** Rounded card on the raised surface (§3.4: 20–22 px). */
export function Card({ tint, interactive, padding = "md", className, style, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-card border border-line bg-surface-raised",
        interactive && "transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-deep",
        PADDING[padding],
        className,
      )}
      style={
        tint
          ? {
              backgroundImage:
                "radial-gradient(ellipse 80% 60% at 50% 25%, color-mix(in srgb, var(--secondary) 55%, transparent), transparent 75%), linear-gradient(180deg, color-mix(in srgb, var(--secondary) 30%, var(--bg-raised)), var(--bg-base))",
              ...style,
            }
          : style
      }
      {...rest}
    />
  );
}
