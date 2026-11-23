import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { AtmosphereBackground } from "@/components/atmosphere/AtmosphereBackground";
import { Container } from "@/components/layout/Container";
import { PeriodTheme } from "@/components/layout/PeriodTheme";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Link } from "@/i18n/navigation";

export interface ScreenSkeletonProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Back link of full-screen simulations (they have no site header). */
  back?: { href: string; label: string };
  /** The legacy page that still serves this screen. */
  legacyHref?: string;
  themeId?: string;
  empty?: { title?: string; text?: string };
  children?: React.ReactNode;
}

/**
 * Route skeleton of a screen whose phase has not come yet (phase 2): its real
 * title from data, its period theme, a clear "being prepared" state and a link
 * to the page that serves it today.
 */
export function ScreenSkeleton({ eyebrow, title, subtitle, back, legacyHref, themeId, empty, children }: ScreenSkeletonProps) {
  const t = useTranslations("pages");
  return (
    <section className="relative isolate flex flex-1 flex-col overflow-hidden" data-testid="screen-skeleton">
      {themeId ? <PeriodTheme id={themeId} /> : null}
      <AtmosphereBackground silhouette="mountains" pattern={0.06} glow={{ x: "80%", y: "10%", strength: 0.16 }} />
      {back ? (
        <Container className="pt-6">
          <Link href={back.href} className="inline-flex min-h-11 items-center gap-2 text-14 text-fg-secondary hover:text-accent">
            <ArrowLeft aria-hidden size={18} /> {back.label}
          </Link>
        </Container>
      ) : null}
      <Container className="flex flex-col gap-5 pb-56 pt-14">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="m-0 font-heading text-44 font-medium leading-tight text-fg md:text-60">{title}</h1>
        {subtitle ? <p className="m-0 max-w-2xl text-16 text-fg-secondary md:text-19">{subtitle}</p> : null}
        {children}
        <EmptyState
          className="max-w-2xl bg-surface/40 backdrop-blur-sm"
          title={empty?.title ?? t("preparing")}
          description={empty?.text}
          action={
            legacyHref ? (
              <ButtonLink href={legacyHref} variant="outline" shape="pill">
                {t("openLegacy")} <span aria-hidden>→</span>
              </ButtonLink>
            ) : undefined
          }
        />
      </Container>
    </section>
  );
}
