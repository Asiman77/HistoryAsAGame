import { themeCss } from "@/theme/resolve";
import type { ThemeTokens } from "@/theme/tokens";

/** The [data-theme] blocks of the themes a page uses, rendered once at build time. */
export function ThemeStyles({ themes }: { themes: Record<string, ThemeTokens> }) {
  return <style data-theme-styles="">{themeCss(themes)}</style>;
}
