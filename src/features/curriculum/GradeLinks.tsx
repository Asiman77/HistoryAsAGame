"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { ordinal } from "@/lib/ordinal";
import { ROUTES } from "@/lib/routes";
import { GRADES, setLastGrade, usePrefs, type Grade } from "@/stores/prefs";

/**
 * Grade tiles 6–11 as links (Curriculum artboard). The current grade, or
 * the last one the viewer opened, is highlighted; opening one remembers it.
 */
export function GradeLinks({ current, className }: { current?: Grade; className?: string }) {
  const t = useTranslations("home.curriculum");
  const last = usePrefs((p) => p.lastGrade);
  const active = current ?? last;
  return (
    <nav aria-label={t("pick")} className={cx("flex flex-wrap gap-2", className)}>
      {GRADES.map((g) => (
        <Link
          key={g}
          href={ROUTES.grade(g)}
          onClick={() => setLastGrade(g)}
          aria-label={t("open", { grade: ordinal(g) })}
          aria-current={g === current ? "page" : g === active ? "true" : undefined}
          className={cx(
            "inline-flex size-14 items-center justify-center rounded-button-lg border text-19 font-medium transition-colors",
            g === active ? "border-accent bg-accent text-accent-ink" : "border-fg/15 text-fg hover:border-line-strong hover:bg-fg/5",
          )}
        >
          {g}
        </Link>
      ))}
    </nav>
  );
}

/** Remembers the grade a page shows, so /kurikulum/ opens it next time. */
export function RememberGrade({ grade }: { grade: Grade }) {
  useEffect(() => setLastGrade(grade), [grade]);
  return null;
}
