/**
 * Paths of the new design, without locale (next-intl adds it). Screens not
 * rebuilt yet point to their legacy page until their phase replaces it and
 * the legacy route becomes a redirect (ADR-0022). Simulation URLs come from
 * entityPath() in src/domain/registry.ts.
 */
export const ROUTES = {
  home: "/",
  curriculum: "/kurikulum/",
  grade: (grade: number) => `/kurikulum/${grade}/`,
  timeline: "/zaman/",
  persons: "/sexsiyyetler/",
  conflicts: "/doyusler/",
  states: "/dovletler/",
  places: "/mekanlar/",
  /** Phase 10 moves it to /muqayise/. */
  compare: "/compare/",
  passport: "/pasport/",
  teacher: "/muellim/",
} as const;
