"use client";

import { useRef } from "react";
import { cx } from "@/lib/cx";
import { Dawn, Dust, GirihPattern, Ground, Silhouette, Stars, VignetteGrain, type GlowProps, type SilhouetteKind } from "./layers";
import { useStillness } from "./useStillness";

export type AtmosphereEffect = "dust" | "stars" | "dawn";

export interface AtmosphereBackgroundProps {
  /** Radial light over the ground; `false` for none. */
  glow?: GlowProps | false;
  /** Paint the night → dawn sky instead of the theme ground (war intro). */
  sky?: boolean;
  /** Girih pattern opacity (0.06–0.1); `false` for none. */
  pattern?: number | false;
  silhouette?: SilhouetteKind | "none";
  effects?: AtmosphereEffect[];
  vignette?: boolean;
  grain?: boolean;
  /** Silhouette follows the pointer by 2–6 px. */
  parallax?: boolean;
  /** `fixed` covers the viewport behind a page, `absolute` fills the parent (a hero). */
  position?: "absolute" | "fixed";
  /** Forces still (true) or moving (false); by default reduced motion and light mode decide. */
  still?: boolean;
  className?: string;
}

/**
 * Layered period backdrop (§3.5): ground and light, girih pattern, silhouette,
 * effects, vignette and grain. Decorative only (aria-hidden), never covers
 * content (pointer-events: none, behind its siblings). With reduced motion or
 * light mode every layer is static and the particles are not drawn at all.
 */
export function AtmosphereBackground({
  glow = {},
  sky = false,
  pattern = 0.09,
  silhouette = "none",
  effects = [],
  vignette = true,
  grain = true,
  parallax = true,
  position = "absolute",
  still: force,
  className,
}: AtmosphereBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useStillness(ref, force);
  return (
    <div
      ref={ref}
      aria-hidden
      data-testid="atmosphere-background"
      data-still={still ? "true" : "false"}
      className={cx("pointer-events-none inset-0 -z-10 overflow-hidden", position === "fixed" ? "fixed" : "absolute", className)}
    >
      <Ground glow={glow} sky={sky} />
      {pattern !== false ? <GirihPattern opacity={pattern} /> : null}
      {effects.includes("dawn") ? <Dawn /> : null}
      {effects.includes("stars") ? <Stars still={still} /> : null}
      {effects.includes("dust") && !still ? <Dust /> : null}
      {silhouette !== "none" ? <Silhouette kind={silhouette} parallax={parallax && !still} /> : null}
      <VignetteGrain vignette={vignette} grain={grain} />
    </div>
  );
}
