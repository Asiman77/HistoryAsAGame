import { defineRouting } from "next-intl/routing";

/**
 * Locales with UI strings. en and ru follow in phase 15 (locales/*.json).
 * Static export has no proxy, so every URL carries its locale (ADR-0022).
 */
export const routing = defineRouting({
  locales: ["az"],
  defaultLocale: "az",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
