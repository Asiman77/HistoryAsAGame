import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cx } from "@/lib/cx";

export interface ChipProps {
  children: React.ReactNode;
  /** Live link; without it the chip is passive ("tezliklə"). */
  href?: string;
  /** Tint of an active chip; defaults to the period's second colour. */
  tone?: "secondary" | "accent";
  className?: string;
}

const TONE = {
  secondary: "border-secondary/70 bg-secondary/35 hover:bg-secondary/55",
  accent: "border-line-strong bg-accent/12 hover:bg-accent/20",
};

/**
 * Related-entity chip (§5.1 RelatedChips). Active: a link with an arrow.
 * Passive: dashed, muted, not focusable, labelled "tezliklə" so the reader
 * knows the link will open once the content exists.
 */
export function Chip({ children, href, tone = "secondary", className }: ChipProps) {
  const t = useTranslations("ui");
  if (!href) {
    return (
      <span className={cx("inline-flex min-h-9 items-center gap-1 rounded-button border border-dashed border-fg/25 px-3 text-13 text-fg-muted", className)}>
        {children} <span aria-hidden>·</span> <span>{t("comingSoon")}</span>
      </span>
    );
  }
  return (
    <Link href={href} className={cx("inline-flex min-h-9 items-center gap-1.5 rounded-button border px-3 text-13 font-medium text-fg transition-colors", TONE[tone], className)}>
      {children} <span aria-hidden>→</span>
    </Link>
  );
}
