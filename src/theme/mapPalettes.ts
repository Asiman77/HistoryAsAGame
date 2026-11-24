import type { MAP_STYLE_VARIANTS } from "@/domain/schema";
import { mix } from "./color";
import { STATIC_TOKENS } from "./tokens";

/**
 * Base-map colours per period variant (FRONTEND_SPEC §7: parchment, night,
 * modern schematic). MapLibre paint cannot read CSS variables, so the map
 * gets concrete colours here, derived from the map tokens of tokens.css.
 */
export interface MapPalette {
  ground: string;
  water: string;
  waterEdge: string;
  river: string;
  reliefOpacity: number;
  reliefSaturation: number;
  shadow: string;
  highlight: string;
  accent: string;
  /** Ink of borders, trails, labels. */
  ink: string;
  /** Halo behind labels. */
  halo: string;
}

const T = STATIC_TOKENS;

const parchment: MapPalette = {
  ground: T["map-parchment-center"],
  water: T["map-water"],
  waterEdge: mix(T["map-water"], T["map-ink"], 0.35),
  river: mix(T["map-water"], T["map-ink"], 0.2),
  reliefOpacity: 0.55,
  reliefSaturation: -0.8,
  shadow: T["map-ink"],
  highlight: "#FFF6E0",
  accent: T["map-parchment-mid"],
  ink: T["map-ink"],
  halo: T["map-parchment-center"],
};

export type MapVariant = (typeof MAP_STYLE_VARIANTS)[number];

export const MAP_PALETTES: Record<MapVariant, MapPalette> = {
  /** The default parchment. */
  manuscript: parchment,
  /** Tabriz and Safavid miniatures: warmer gold ground, greener water. */
  miniature: { ...parchment, ground: mix(T["map-parchment-center"], T["map-parchment-mid"], 0.25), water: mix(T["map-water"], "#4F8F88", 0.3), reliefOpacity: 0.5 },
  /** Campaign map: drier, darker ground and stronger relief. */
  military: { ...parchment, ground: mix(T["map-parchment-center"], T["map-parchment-edge"], 0.12), water: mix(T["map-water"], "#5F6F69", 0.25), reliefOpacity: 0.65, reliefSaturation: -0.9 },
  /** Modern schematic (2020): neutral grey-blue. */
  modern: {
    ...parchment,
    ground: "#DDE3E6",
    water: "#A9C7D8",
    waterEdge: "#6F9AB5",
    river: "#7FA8C2",
    reliefOpacity: 0.45,
    reliefSaturation: -1,
    shadow: "#3D4A57",
    highlight: "#FFFFFF",
    accent: "#7D8A96",
    ink: "#2B3640",
    halo: "#EEF2F4",
  },
};

/** Route colour on the map: the period's second colour (Səfəvi red, lapis…). */
export const ROUTE_FALLBACK = "#9E2A2B";
