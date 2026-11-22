"use client";

import { useTranslations } from "next-intl";
import { cx } from "@/lib/cx";

export interface EmptyStateProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Clear empty state where data does not exist yet (§0.5: content is never invented). */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  const t = useTranslations("ui");
  return (
    <div role="status" className={cx("flex flex-col items-start gap-3 rounded-card border border-dashed border-fg/20 px-6 py-7", className)}>
      {icon ? <span className="text-accent">{icon}</span> : null}
      <p className="m-0 font-heading text-22 text-fg">{title ?? t("preparing")}</p>
      {description ? <p className="m-0 max-w-prose text-15 text-fg-secondary">{description}</p> : null}
      {action}
    </div>
  );
}

/** Passive "tezliklə" pill for things announced but not built yet. */
export function ComingSoon({ children, className }: { children?: React.ReactNode; className?: string }) {
  const t = useTranslations("ui");
  return (
    <span className={cx("inline-flex min-h-9 items-center gap-1 rounded-button border border-dashed border-fg/25 px-3 text-13 text-fg-muted", className)}>
      {children ? (
        <>
          {children} <span aria-hidden>·</span>{" "}
        </>
      ) : null}
      {t("comingSoon")}
    </span>
  );
}
