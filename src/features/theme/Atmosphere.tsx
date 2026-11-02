"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import type { BackgroundArt, Locale, Theme } from "@/domain/schema";
import { t } from "@/lib/i18n";
import { withBasePath } from "@/lib/basePath";
import { AmbientParticles } from "./AmbientParticles";
import { KarabakhMountains } from "./KarabakhMountains";
import { FrameOrnament } from "./ornaments";
import { useCalmVisuals } from "./ThemeShell";

/**
 * The period backdrop in four layers: (1) blurred art with a slow parallax,
 * (2) a texture, (3) an ornament frame, (4) a light ambient effect. Everything
 * is decorative (aria-hidden, no pointer events) and kept faint, so text on top
 * stays readable. Light mode and reduced motion drop the motion and the effects.
 */
export function Atmosphere({ theme, variant }: { theme: Theme; variant: "page" | "overlay" }) {
  const { light, calm } = useCalmVisuals();
  const art = theme.backgroundArt[0];

  if (variant === "overlay") {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0" data-testid="atmosphere-overlay">
        {!calm && <Ambient theme={theme} dense={false} />}
        <FrameOrnament kind={theme.ornaments.border} corner="none" thin />
      </div>
    );
  }

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-parchment" data-testid="atmosphere" data-theme-id={theme.id}>
      <AnimatePresence initial={false}>
        {art && (
          <motion.div
            key={`${theme.id}:${art.src ?? art.procedural ?? "placeholder"}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: calm ? 0 : 1.4, ease: "easeInOut" }}
          >
            <ArtLayer art={art} parallax={!calm} light={light} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="atmo-tint absolute inset-0" />
      <div className={`texture-${theme.textures.background} absolute inset-0`} />
      {!calm && <Ambient theme={theme} dense />}
      <FrameOrnament kind={theme.ornaments.border} corner={theme.ornaments.corner} />
    </div>
  );
}

function Ambient({ theme, dense }: { theme: Theme; dense: boolean }) {
  switch (theme.ambientEffect) {
    case "dust":
    case "embers":
      return <AmbientParticles kind={theme.ambientEffect} count={dense ? 26 : 14} />;
    case "candle":
      return <div className="ambient-candle absolute inset-0" />;
    case "mist":
      return <div className="ambient-mist absolute inset-0" />;
    default:
      return null;
  }
}

function ArtLayer({ art, parallax, light }: { art: BackgroundArt; parallax: boolean; light: boolean }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 2400], [0, parallax ? -140 : 0]);
  return (
    <motion.div className="absolute -inset-x-[3%] -top-[3%] -bottom-[12%]" style={{ y }}>
      <div className="absolute inset-0 opacity-[0.24]">
        <StaticArt art={art} light={light} />
      </div>
    </motion.div>
  );
}

/** The theme's art alone, still and a little stronger: behind the start card of a simulation. */
export function ThemeArt({ theme, credit }: { theme: Theme; credit?: React.ReactNode }) {
  const { light } = useCalmVisuals();
  const art = theme.backgroundArt[0];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" data-testid="theme-art" data-theme-id={theme.id}>
      {art && (
        <div className="absolute inset-0 [&_.atmo-art]:opacity-[0.55]">
          <div className="absolute inset-0 scale-105">
            <StaticArt art={art} light={light} />
          </div>
        </div>
      )}
      <div className={`texture-${theme.textures.background} absolute inset-0`} />
      <div className="absolute inset-0 bg-ink/25" />
      {credit && <div className="pointer-events-auto absolute inset-x-0 bottom-2 px-4 [&_p]:text-parchment-light/80">{credit}</div>}
    </div>
  );
}

function StaticArt({ art, light }: { art: BackgroundArt; light: boolean }) {
  if (art.procedural === "karabakh-mountains") return <KarabakhMountains className="atmo-art h-full w-full" />;
  if (!art.src) return <div className="texture-manuscript h-full w-full" />;
  return (
    <picture>
      <source type="image/avif" srcSet={`${withBasePath(art.src)}-sm.avif 700w, ${withBasePath(art.src)}.avif 1400w`} sizes="100vw" />
      <source type="image/webp" srcSet={`${withBasePath(art.src)}-sm.webp 700w, ${withBasePath(art.src)}.webp 1400w`} sizes="100vw" />
      <img
        src={`${withBasePath(art.src)}${light ? "-sm" : ""}.webp`}
        alt=""
        loading="lazy"
        decoding="async"
        className="atmo-art h-full w-full object-cover"
        style={{ objectPosition: art.focus ?? "50% 50%" }}
      />
    </picture>
  );
}

/** Credit line for the backdrop art (shown at the foot of themed pages). */
export function ArtCredit({ theme, locale, label }: { theme: Theme; locale: Locale; label: { art: string; ai: string } }) {
  const art = theme.backgroundArt[0];
  if (!art) return null;
  const text = `${label.art}: ${t(art.title, locale)}${art.kind === "ai_illustration" ? ` · ${label.ai}` : ""} · ${art.source} · ${art.license}`;
  return (
    <p className="text-center text-[11px] leading-snug text-ink-faint" data-testid="art-credit">
      {art.sourceUrl ? (
        <a href={art.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-ink">
          {text}
        </a>
      ) : (
        text
      )}
    </p>
  );
}
