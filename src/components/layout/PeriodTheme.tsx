"use client";

import { usePeriodTheme } from "@/stores/theme";

/** Puts the page in a period theme while it is shown (server pages render this). */
export function PeriodTheme({ id }: { id: string | null | undefined }) {
  usePeriodTheme(id);
  return null;
}
