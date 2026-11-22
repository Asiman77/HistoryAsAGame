import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

/**
 * Part of a page in another period's colours (a person card, a place
 * timeline item). The theme's [data-theme] block must be on the page
 * (ThemeStyles); every token-based utility inside follows it.
 */
export function ThemeScope({ themeId, className, ...rest }: ComponentProps<"div"> & { themeId: string }) {
  return <div data-theme={themeId} className={cx("text-fg", className)} {...rest} />;
}
