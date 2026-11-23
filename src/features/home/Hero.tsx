import { useTranslations } from "next-intl";
import { AtmosphereBackground } from "@/components/atmosphere/AtmosphereBackground";
import { Container } from "@/components/layout/Container";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ROUTES } from "@/lib/routes";
import type { RoutePoint } from "./data";

/** Sample route across the sky (§6.1), decorative: the labels come from data. */
function SkyRoute({ route }: { route: [RoutePoint, RoutePoint] }) {
  const [a, b] = route;
  return (
    <svg aria-hidden viewBox="0 0 1440 780" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 hidden h-full w-full text-accent md:block">
      <path className="ds-animate-drift" d="M 820 430 C 940 300, 1080 260, 1190 300 S 1330 210, 1400 160" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" opacity="0.8" />
      {[
        [820, 430],
        [1190, 300],
      ].map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y} r="5" fill="currentColor" />
          <circle className="ds-animate-pulse" cx={x} cy={y} r="16" fill="none" stroke="currentColor" strokeWidth="1" />
        </g>
      ))}
      <circle cx="1400" cy="160" r="4" fill="currentColor" opacity="0.7" />
      <text x="836" y="456" fill="currentColor" className="font-heading" fontSize="15" fontStyle="italic">
        {a.place} · {a.year}
      </text>
      <text x="1206" y="326" fill="currentColor" className="font-heading" fontSize="15" fontStyle="italic">
        {b.place} · {b.year}
      </text>
    </svg>
  );
}

export interface HeroProps {
  route: [RoutePoint, RoutePoint] | null;
  counts: { persons: number; conflicts: number; states: number };
}

export function Hero({ route, counts }: HeroProps) {
  const t = useTranslations("home");
  const b = (chunks: React.ReactNode) => <strong className="font-semibold text-fg">{chunks}</strong>;
  return (
    <section className="relative isolate flex min-h-[720px] flex-col overflow-hidden md:min-h-[780px]" aria-labelledby="hero-title">
      <AtmosphereBackground silhouette="mountains" effects={["dust"]} glow={{ x: "70%", y: "18%", strength: 0.22 }} />
      {route ? <SkyRoute route={route} /> : null}
      <Container className="relative pb-56 pt-40 md:pt-48">
        <div className="flex max-w-[640px] flex-col gap-6">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h1 id="hero-title" className="m-0 font-heading text-48 font-medium leading-[1.02] text-fg sm:text-60 md:text-76">
            {t.rich("title", { em: (chunks) => <em className="font-medium text-accent">{chunks}</em> })}
          </h1>
          <p className="m-0 max-w-[560px] text-16 text-fg-secondary sm:text-19">{t("lead")}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink href={ROUTES.persons} shape="pill" size="lg">
              {t("start")} <span aria-hidden>→</span>
            </ButtonLink>
            <a href="#how" className={buttonClass({ variant: "secondary", shape: "pill", size: "lg" })}>
              {t("how")}
            </a>
          </div>
          <ul aria-label={t("counts.label")} className="m-0 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 pt-4 text-13 text-fg-muted">
            <li>{t.rich("counts.persons", { n: counts.persons, b })}</li>
            <li>{t.rich("counts.conflicts", { n: counts.conflicts, b })}</li>
            <li>{t.rich("counts.states", { n: counts.states, b })}</li>
            <li>{t("counts.more")}</li>
          </ul>
        </div>
      </Container>
    </section>
  );
}
