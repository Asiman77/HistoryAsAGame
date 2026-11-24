import { cx } from "@/lib/cx";
import type { FinalRoute } from "./finalAdapter";

/** Whole replay in about this long, whatever the number of movements. */
const TOTAL_MS = 6000;
const SEGMENT_MIN_MS = 280;
const SEGMENT_MAX_MS = 800;
const START_MS = 300;

/** Sizes in px of a ~760 px wide drawing, scaled to map units by CSS (`--u` map units per px, `--k` ×2 on narrow screens). */
const px = (n: number) => `calc(var(--u) * var(--k) * ${n}px)`;

/**
 * The whole life route (§6.9), drawn movement after movement: dashed gold
 * lines over a faint coastline, each place appearing when the story reaches
 * it. Pure SVG and CSS, so it costs nothing on a weak machine; reduced motion
 * and light mode show the finished drawing at once. Strokes, dots and labels
 * are sized in CSS, so they stay readable when the drawing is phone-sized.
 */
export function LifeRoute({ route, title, className }: { route: FinalRoute; title: string; className?: string }) {
  const n = Math.max(1, route.segments.length);
  const dur = Math.min(SEGMENT_MAX_MS, Math.max(SEGMENT_MIN_MS, TOTAL_MS / n));
  // Movements take `dur` one after another; a place appears when the last movement up to its step ends.
  const timed = route.segments.map((s, i) => ({ ...s, at: START_MS + i * dur }));
  const placeAt = (firstStep: number) => START_MS + timed.filter((s) => s.index <= firstStep).length * dur;
  const [x, y, w, h] = route.viewBox.split(" ").map(Number) as [number, number, number, number];
  return (
    <svg
      viewBox={route.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={title}
      className={cx("[--k:2] sm:[--k:1.4] lg:[--k:1]", className)}
      style={{ ["--u" as string]: route.unit }}
      data-testid="life-route"
    >
      <path d={route.land} fill="none" stroke="currentColor" strokeOpacity={0.14} style={{ strokeWidth: px(1) }} />
      <defs>
        {timed.map((s) => (
          // The mask region must be the drawing itself: map y is −latitude, so the default region would miss it.
          <mask key={s.index} id={`life-route-${s.index}`} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
            <path
              d={s.d}
              pathLength={1}
              className="ds-draw"
              style={{ ["--dur" as string]: `${dur}ms`, ["--delay" as string]: `${s.at}ms`, strokeWidth: px(12) }}
              fill="none"
              stroke="white"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </mask>
        ))}
      </defs>
      <g className="text-accent">
        {timed.map((s) => (
          <path
            key={s.index}
            d={s.d}
            mask={`url(#life-route-${s.index})`}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            style={{ strokeWidth: px(2.5), strokeDasharray: `${px(2)} ${px(8)}` }}
          />
        ))}
        {route.places.map((p) => (
          <g key={`${p.x},${p.y}`} className="ds-appear" style={{ ["--delay" as string]: `${placeAt(p.firstStep)}ms` }}>
            <circle cx={p.x} cy={p.y} fill="currentColor" style={{ r: px(p.major ? 7 : 5) }} />
            {p.label ? (
              <text
                x={p.x}
                y={p.y}
                fill="currentColor"
                fontStyle="italic"
                dominantBaseline="middle"
                // On phones only the places the story returns to keep their names; the rest would collide.
                className={cx("font-heading", !p.major && "max-sm:hidden")}
                style={{ fontSize: px(15), transform: `translateX(${px(14)})` }}
              >
                {p.name}
              </text>
            ) : null}
          </g>
        ))}
      </g>
    </svg>
  );
}
