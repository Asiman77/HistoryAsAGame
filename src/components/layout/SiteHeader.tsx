"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { Logo } from "@/components/icons";
import { buttonClass } from "@/components/ui/Button";
import { Link, usePathname } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { ROUTES } from "@/lib/routes";

const NAV = [
  { key: "curriculum", href: ROUTES.curriculum },
  { key: "timeline", href: ROUTES.timeline },
  { key: "persons", href: ROUTES.persons },
  { key: "conflicts", href: ROUTES.conflicts },
  { key: "states", href: ROUTES.states },
  { key: "places", href: ROUTES.places },
] as const;

const isActive = (pathname: string, href: string) => href !== "/" && (pathname === href || pathname.startsWith(href) || `${pathname}/` === href);

/**
 * Site header of the design: logo, main sections, teacher mode. Below md the
 * sections fold into a menu button (Escape and navigation close it).
 * On the home page it lies over the hero (transparent, as in the design);
 * elsewhere it sits on the page surface with a hairline.
 */
export function SiteHeader() {
  const t = useTranslations("site");
  const pathname = usePathname();
  const overlay = pathname === "/";
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const menuId = useId();

  // Close the menu after navigation (render-time reset, no effect needed).
  if (open && openedAt !== pathname) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const links = (vertical: boolean) =>
    NAV.map((item) => {
      const active = isActive(pathname, item.href);
      return (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cx(
            "transition-colors hover:text-accent",
            active ? "font-semibold text-accent" : "text-fg-secondary",
            vertical ? "flex min-h-12 items-center border-b border-line text-16" : "text-15",
          )}
        >
          {t(`nav.${item.key}`)}
        </Link>
      );
    });

  return (
    <header className={cx("z-30", overlay ? "absolute inset-x-0 top-0" : "relative border-b border-line bg-surface/80 backdrop-blur-md")} data-testid="site-header">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-button focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink">
        {t("skip")}
      </a>
      <div className="mx-auto flex max-w-content items-center justify-between gap-6 px-4 py-5 sm:px-5 md:px-10 md:py-7">
        <Link href={ROUTES.home} className="flex items-center gap-3 text-fg">
          <Logo size={34} className="text-accent" />
          <span className="whitespace-nowrap font-heading text-19 font-bold tracking-[0.02em] sm:text-22">{t("brand")}</span>
        </Link>
        <nav aria-label={t("navLabel")} className="hidden items-center gap-7 lg:flex">
          {links(false)}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block">
            <Link href={ROUTES.teacher} className={buttonClass({ variant: "outline", shape: "pill" })}>
              {t("teacher")}
            </Link>
          </span>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-button border border-fg/15 text-fg lg:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? t("menuClose") : t("menuOpen")}
            onClick={() => {
              setOpenedAt(pathname);
              setOpen((v) => !v);
            }}
          >
            {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </div>
      {open ? (
        <nav id={menuId} aria-label={t("navLabel")} className="absolute inset-x-0 top-full border-b border-line bg-surface-panel px-5 pb-6 shadow-deep lg:hidden">
          {links(true)}
          <div className="mt-5 sm:hidden">
            <Link href={ROUTES.teacher} className={buttonClass({ variant: "outline", shape: "pill" })}>
              {t("teacher")}
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
