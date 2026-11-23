import { Link } from "@/i18n/navigation";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "md" | "lg";
export type ButtonShape = "rounded" | "pill";

interface StyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
}

const VARIANT: Record<ButtonVariant, string> = {
  /** Gold on the period accent; white in 2020 (its accent). */
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  /** Quiet: hairline in the text colour. */
  secondary: "border border-fg/25 text-fg hover:border-fg/50 hover:bg-fg/5",
  /** Accent outline, e.g. "Müəllim rejimi". */
  outline: "border border-line-strong text-accent hover:border-accent hover:bg-accent/10",
  ghost: "text-accent hover:text-accent-hover",
};

const SIZE: Record<ButtonSize, string> = {
  md: "min-h-11 px-[18px] text-14",
  lg: "min-h-[52px] px-[22px] text-15",
};

const SHAPE: Record<ButtonShape, string> = { rounded: "rounded-button-lg", pill: "rounded-full" };

/** Class names of a button, for elements that cannot use the components below. */
export function buttonClass({ variant = "primary", size = "md", shape = "rounded" }: StyleProps = {}, className?: string) {
  return cx(
    "inline-flex select-none items-center justify-center gap-2 font-semibold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    variant === "ghost" ? "px-0" : SHAPE[shape],
    className,
  );
}

export type ButtonProps = ComponentProps<"button"> & StyleProps;

/** Real <button> (§11). Touch target at least 44 px. */
export function Button({ variant, size, shape, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, shape }, className)} {...rest} />;
}

export type ButtonLinkProps = ComponentProps<typeof Link> & StyleProps;

/** A link that looks like a button: navigation stays a real <a>. */
export function ButtonLink({ variant, size, shape, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, shape }, className)} {...rest} />;
}
