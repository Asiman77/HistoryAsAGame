"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { Locale } from "@/domain/schema";
import type { TimeExplorerData } from "@/data/timeExplorer";
import type { Messages } from "@/lib/i18n";
import { TimeExplorer } from "./TimeExplorer";

/** First Safavid year: a lively default (new borders, a coronation, Şah İsmayıl alive). */
export const DEFAULT_YEAR = 1501;

function WithYear(props: { data: TimeExplorerData; locale: Locale; messages: Messages }) {
  const raw = Number(useSearchParams().get("year"));
  const year = Number.isInteger(raw) && raw >= props.data.from && raw <= props.data.to ? raw : DEFAULT_YEAR;
  // Only the first value matters: the explorer then owns the year and mirrors it into the URL.
  return <TimeExplorer {...props} initialYear={year} syncUrl />;
}

export function TimelinePageClient(props: { data: TimeExplorerData; locale: Locale; messages: Messages }) {
  return (
    // The static HTML cannot know ?year=, so it shows a light placeholder instead of a second map.
    <Suspense fallback={<div className="paper-card h-[58vh] min-h-80 animate-pulse rounded-lg" aria-busy="true" />}>
      <WithYear {...props} />
    </Suspense>
  );
}
