"use client";

import { useMessages, useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stamp } from "@/features/final/PassportStamps";
import { ROUTES } from "@/lib/routes";
import { usePassport } from "@/stores/passport";

export interface PassportEntry {
  id: string;
  name: string;
}

export interface PassportBookProps {
  entries: PassportEntry[];
  /** Simulation key → title and link ("shah-ismayil" → "Şah İsmayıl"). */
  sims: Record<string, { title: string; href: string }>;
}

/**
 * Tarix pasportu (/pasport/): every stamp the student has earned on this
 * device, in the order of the first visit, with where it came from. Data
 * lives in localStorage only; the static page renders the empty state and
 * the stamps appear after hydration.
 */
export function PassportBook({ entries, sims }: PassportBookProps) {
  const t = useTranslations("passport");
  const pages = useTranslations("pages.passport");
  const stamps = usePassport((p) => p.stamps);
  const owned = entries
    .filter((e) => stamps[e.id])
    .map((e) => ({ ...e, stamp: stamps[e.id]! }))
    .sort((a, b) => a.stamp.at - b.stamp.at);
  // Month names from our messages: browsers' ICU data for Azerbaijani is uneven ("2026 M11 24").
  const months = useMessages().months as unknown as string[];
  const date = (ms: number) => {
    const d = new Date(ms);
    return `${d.getDate()} ${months[d.getMonth()] ?? d.getMonth() + 1} ${d.getFullYear()}`;
  };

  if (!owned.length) {
    return (
      <EmptyState
        className="max-w-2xl bg-surface/40 backdrop-blur-sm"
        title={pages("empty")}
        description={pages("emptyText")}
        action={
          <ButtonLink href={ROUTES.persons} shape="pill">
            {t("start")} <span aria-hidden>→</span>
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="passport-book">
      <p className="m-0 text-15 text-fg-secondary">
        <span className="font-heading text-26 text-fg" data-testid="passport-count">
          {t("count", { n: owned.length, total: entries.length })}
        </span>{" "}
        · {t("local")}
      </p>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-8 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {owned.map((e, i) => {
          const sim = sims[e.stamp.from];
          return (
            <li key={e.id} className="flex flex-col items-center gap-3 text-center">
              <Stamp id={e.id} name={e.name} index={i} fresh={false} size="lg" />
              <span className="text-12 leading-snug text-fg-muted">
                {sim ? t("from", { sim: sim.title, date: date(e.stamp.at) }) : date(e.stamp.at)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
