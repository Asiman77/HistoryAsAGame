import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";

/**
 * Footer of the design. Links go only to pages that exist: the design's
 * "Mənbələr · Lisenziyalar · Məxfilik" wait for their pages (open question in
 * the phase 2 report).
 */
export function SiteFooter() {
  const t = useTranslations("site");
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-4 px-4 py-7 text-13 text-fg-muted sm:px-5 md:px-10">
        <p className="m-0">{t("footer")}</p>
        <nav aria-label={t("footerNav")} className="flex gap-5">
          <Link href={ROUTES.compare} className="hover:text-accent">
            {t("nav.compare")}
          </Link>
          <Link href={ROUTES.passport} className="hover:text-accent">
            {t("nav.passport")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
