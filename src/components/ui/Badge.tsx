import { cx } from "@/lib/cx";

export type BadgeVariant = "neutral" | "accent" | "outline";

const VARIANT: Record<BadgeVariant, string> = {
  /** Period label on a card ("Səfəvilər · XVI əsr"). */
  neutral: "border border-fg/15 bg-surface/55 text-fg-secondary backdrop-blur-sm",
  /** Progress flag ("Davam et · 7/14"). */
  accent: "bg-accent text-accent-ink font-semibold",
  outline: "border border-line-strong text-accent",
};

/** Small pill label. */
export function Badge({ variant = "neutral", className, children }: { variant?: BadgeVariant; className?: string; children: React.ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-12 leading-none", VARIANT[variant], className)}>{children}</span>;
}
