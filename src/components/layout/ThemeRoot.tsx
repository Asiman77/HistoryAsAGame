"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cx } from "@/lib/cx";
import { deviceLooksWeak, useSettings } from "@/lib/settings";
import { useThemeStore } from "@/stores/theme";

const noop = () => () => {};

/**
 * Root of every page of the new design: period theme (data-theme, crossfading
 * through the registered tokens), light mode class and the design base styles.
 * The theme is mirrored on <html> so portals and overscroll follow it.
 */
export function ThemeRoot({ defaultTheme = "default", children }: { defaultTheme?: string; children: React.ReactNode }) {
  const override = useThemeStore((s) => s.override);
  const theme = override ?? defaultTheme;
  const settings = useSettings();
  const weak = useSyncExternalStore(noop, deviceLooksWeak, () => false);
  const lite = settings.lightMode ?? weak;

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("ds");
    html.dataset.theme = theme;
    html.classList.toggle("lite", lite);
    return () => {
      html.classList.remove("ds", "lite");
      delete html.dataset.theme;
    };
  }, [theme, lite]);

  return (
    <div data-theme={theme} data-testid="theme-root" className={cx("ds-root flex min-h-dvh flex-col", lite && "lite")}>
      {children}
    </div>
  );
}
