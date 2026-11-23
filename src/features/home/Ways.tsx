"use client";

import { BookOpen, Hourglass, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { GradeLinks } from "@/features/curriculum/GradeLinks";

const WAYS = [
  { key: "curriculum", href: ROUTES.curriculum, icon: BookOpen },
  { key: "timeline", href: ROUTES.timeline, icon: Hourglass },
  { key: "collections", href: ROUTES.persons, icon: LayoutGrid },
] as const;

/**
 * "Necə işləyir?": the three ways into history (§1) and the grade picker of
 * "Dərsliklə öyrən" (§6.1). Topic cards follow when the curriculum has content.
 */
export function Ways() {
  const t = useTranslations("home");
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-24 py-20">
      <Container className="flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <Eyebrow>{t("ways.eyebrow")}</Eyebrow>
          <h2 id="how-title" className="m-0 font-heading text-34 font-medium text-fg sm:text-38">
            {t("ways.title")}
          </h2>
          <p className="m-0 max-w-2xl text-16 text-fg-secondary">{t("ways.engine")}</p>
        </div>
        <ul className="m-0 grid list-none gap-5 p-0 md:grid-cols-3">
          {WAYS.map(({ key, href, icon: IconCmp }) => (
            <li key={key}>
              <Link href={href} className="group block h-full rounded-card">
                <Card interactive className="flex h-full flex-col gap-3">
                  <IconCmp aria-hidden size={26} strokeWidth={1.6} className="text-accent" />
                  <h3 className="m-0 font-heading text-26 font-medium text-fg">{t(`ways.${key}.title`)}</h3>
                  <p className="m-0 text-15 text-fg-secondary">{t(`ways.${key}.text`)}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>

        <Card padding="lg" className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between" data-testid="curriculum-teaser">
          <div className="flex max-w-xl flex-col gap-3">
            <Eyebrow>{t("curriculum.eyebrow")}</Eyebrow>
            <h3 className="m-0 font-heading text-30 font-medium text-fg">{t("curriculum.title")}</h3>
            <p className="m-0 text-15 text-fg-secondary">{t("curriculum.preparing")}</p>
          </div>
          <GradeLinks />
        </Card>
      </Container>
    </section>
  );
}
