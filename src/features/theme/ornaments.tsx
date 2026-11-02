import { useId } from "react";
import type { BORDER_ORNAMENTS, CORNER_ORNAMENTS, DIVIDER_ORNAMENTS } from "@/domain/schema";

type Border = (typeof BORDER_ORNAMENTS)[number];
type Corner = (typeof CORNER_ORNAMENTS)[number];
type DividerKind = (typeof DIVIDER_ORNAMENTS)[number];

const GOLD = { fill: "var(--color-gold)" } as const;
const PRIMARY = { fill: "var(--color-carmine)" } as const;
const LINE = (w = 1) => ({ fill: "none", stroke: "var(--color-gold)", strokeWidth: w }) as const;

/**
 * Viewport frame: a narrow ornamental band along the edges and a glyph in each
 * corner. `thin` is used over the map, where only a hairline band is drawn.
 */
export function FrameOrnament({ kind, corner, thin = false }: { kind: Border; corner: Corner; thin?: boolean }) {
  const id = useId().replace(/:/g, "");
  if (kind === "none") return null;
  const band = thin ? 4 : 12;
  return (
    <div className="absolute inset-0" data-ornament={kind}>
      {kind === "flag-stripe" ? (
        // Azerbaijani flag colours along the top edge only.
        <div className="absolute inset-x-0 top-0 flex flex-col">
          <span style={{ height: thin ? 3 : 4, background: "#00b5e2" }} />
          <span style={{ height: thin ? 2 : 3, background: "#ef3340" }} />
          <span style={{ height: thin ? 2 : 3, background: "#509e2f" }} />
        </div>
      ) : (
        <>
          <svg width="0" height="0" className="absolute">
            <defs>
              <BandPattern id={`h${id}`} kind={kind} />
              {/* Side bands: the same motif turned upright. */}
              <BandPattern id={`v${id}`} kind={kind} rotate />
            </defs>
          </svg>
          {(["inset-x-0 top-0", "inset-x-0 bottom-0", "inset-y-0 left-0", "inset-y-0 right-0"] as const).map((pos, i) => (
            <svg
              key={pos}
              className={`absolute ${pos} ${thin ? "" : i < 2 ? "h-1.5 sm:h-3" : "w-1.5 sm:w-3"}`}
              style={i < 2 ? { width: "100%", opacity: thin ? 0.55 : 0.8, ...(thin ? { height: band } : {}) } : { height: "100%", opacity: thin ? 0.55 : 0.8, ...(thin ? { width: band } : {}) }}
            >
              <rect width="100%" height="100%" fill={`url(#${i < 2 ? "h" : "v"}${id})`} />
            </svg>
          ))}
        </>
      )}
      {!thin && corner !== "none" && (
        <div className="hidden sm:block">
          {(["top-0 left-0", "top-0 right-0 -scale-x-100", "bottom-0 left-0 -scale-y-100", "bottom-0 right-0 -scale-100"] as const).map((pos) => (
            <CornerGlyph key={pos} kind={corner} className={`absolute size-11 ${pos}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function BandPattern({ id, kind, rotate = false }: { id: string; kind: Border; rotate?: boolean }) {
  const turn = rotate ? "rotate(90)" : undefined;
  switch (kind) {
    case "girih":
      // Interlaced eight-pointed stars, as on Tabriz tile borders.
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform={turn}>
          <rect width="12" height="12" style={{ fill: "var(--color-carmine)", opacity: 0.85 }} />
          <path d="M6 1.5l1.3 3.2 3.2 1.3-3.2 1.3L6 10.5 4.7 7.3 1.5 6l3.2-1.3z" style={GOLD} />
        </pattern>
      );
    case "islimi":
      // Arabesque scroll (islimi) on a turquoise ground.
      return (
        <pattern id={id} width="24" height="12" patternUnits="userSpaceOnUse" patternTransform={turn}>
          <rect width="24" height="12" style={{ fill: "var(--color-carmine)", opacity: 0.9 }} />
          <path d="M0 6c4-5 8-5 12 0s8 5 12 0" style={LINE(1.4)} />
          <circle cx="6" cy="3.6" r="1.2" style={GOLD} />
          <circle cx="18" cy="8.4" r="1.2" style={GOLD} />
        </pattern>
      );
    case "bronze-rule":
      return (
        <pattern id={id} width="16" height="12" patternUnits="userSpaceOnUse" patternTransform={turn}>
          <rect width="16" height="12" style={{ fill: "var(--color-gold)", opacity: 0.55 }} />
          <rect y="5" width="16" height="2" style={{ fill: "var(--color-carmine)", opacity: 0.7 }} />
        </pattern>
      );
    default:
      // double-rule
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform={turn}>
          <rect y="3" width="12" height="1" style={GOLD} />
          <rect y="8" width="12" height="1" style={{ ...GOLD, opacity: 0.5 }} />
        </pattern>
      );
  }
}

function CornerGlyph({ kind, className }: { kind: Corner; className: string }) {
  return (
    <svg viewBox="0 0 44 44" className={className} aria-hidden>
      {kind === "rosette" && (
        <g>
          <circle cx="16" cy="16" r="9" style={LINE(1.2)} />
          <circle cx="16" cy="16" r="3" style={GOLD} />
        </g>
      )}
      {kind === "tile-corner" && (
        <g>
          <path d="M0 0h30L0 30z" style={{ fill: "var(--color-carmine)", opacity: 0.85 }} />
          <path d="M12 4l2.2 5.6L20 12l-5.8 2.4L12 20l-2.2-5.6L4 12l5.8-2.4z" style={GOLD} />
        </g>
      )}
      {kind === "carpet-medallion" && (
        <g>
          <path d="M0 0h34c-2 10-8 18-16 22S2 30 0 34z" style={{ fill: "var(--color-carmine)", opacity: 0.85 }} />
          <path d="M6 6c8 0 14 2 18 6M6 6c0 8 2 14 6 18" style={LINE(1.3)} />
          <circle cx="13" cy="13" r="3" style={GOLD} />
        </g>
      )}
      {kind === "rivet" && (
        <g>
          <path d="M0 0h26v4H4v22H0z" style={{ fill: "var(--color-gold)", opacity: 0.8 }} />
          <circle cx="12" cy="12" r="3.2" style={{ fill: "var(--color-gold)" }} />
          <circle cx="11" cy="11" r="1" style={{ fill: "#fff", opacity: 0.5 }} />
        </g>
      )}
      {kind === "star-corner" && <EightPointStar x={16} y={16} r={10} />}
    </svg>
  );
}

function EightPointStar({ x, y, r }: { x: number; y: number; r: number }) {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.62;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(2)},${(y + rr * Math.sin(a)).toFixed(2)}`);
  }
  return <polygon points={pts.join(" ")} style={{ fill: "var(--color-carmine)", opacity: 0.85 }} />;
}

/** The mark in the middle of a divider rule, per period. */
export function DividerGlyph({ kind, size = 14 }: { kind: DividerKind; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size * (kind === "dagger" || kind === "cloud-band" ? 2 : 1)} height={size} aria-hidden preserveAspectRatio="xMidYMid meet" data-divider={kind}>
      {kind === "star" && (
        <>
          <path d="M12 1.5l2.6 4.2 4.8-1.1-1.1 4.8 4.2 2.6-4.2 2.6 1.1 4.8-4.8-1.1L12 22.5l-2.6-4.2-4.8 1.1 1.1-4.8L1.5 12l4.2-2.6-1.1-4.8 4.8 1.1z" fill="currentColor" />
          <circle cx="12" cy="12" r="3.2" fill="var(--color-parchment-light)" />
        </>
      )}
      {kind === "girih-knot" && (
        <g fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="6" y="6" width="12" height="12" />
          <rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </g>
      )}
      {kind === "cloud-band" && (
        <path d="M2 14c3-6 7-6 8-2 1-5 6-6 8-1 1-3 4-3 5 0M2 14c3 3 6 3 8 0 2 3 6 3 8 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      )}
      {kind === "dagger" && (
        <g fill="currentColor">
          <path d="M3 12l11-1.4v2.8z" />
          <rect x="14" y="8.5" width="1.6" height="7" />
          <rect x="15.6" y="11" width="5" height="2" rx="1" />
        </g>
      )}
      {kind === "eight-point-star" && (
        <g fill="currentColor">
          <rect x="5" y="5" width="14" height="14" />
          <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" />
          <circle cx="12" cy="12" r="3.4" fill="var(--color-parchment-light)" />
        </g>
      )}
    </svg>
  );
}
