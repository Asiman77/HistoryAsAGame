import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

export interface IconButtonProps extends ComponentProps<"button"> {
  /** Accessible name, required: the button shows only an icon. */
  label: string;
  /** Pressed state for toggles (sound on/off). */
  pressed?: boolean;
}

/** 44×44 square button with an icon (back, sound, zoom). */
export function IconButton({ label, pressed, className, type = "button", children, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-button border border-fg/15 bg-surface-raised/70 text-fg backdrop-blur-sm transition-colors hover:border-fg/35 hover:bg-surface-raised",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
