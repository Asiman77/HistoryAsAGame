import type { PlaceType } from "@/domain/schema";

/**
 * Place icons in one hand: ink outlines, flat gold, lapis, turquoise and
 * carmine fills, as in Tabriz-school miniatures. 24×24 viewBox.
 */
const INK = "#2a1c10";
const GOLD = "#c9a646";
const LAPIS = "#2d5486";
const TURQ = "#2f8a84";
const CARMINE = "#9b2c2c";
const PAPER = "#f8f0dd";
const s = `stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;

const BODIES: Record<PlaceType, string> = {
  // Crowned castle
  capital: `<path d="M5 21V11h2V9h2v2h2V9h2v2h2V9h2v2h2v10z" fill="${PAPER}" ${s}/>
    <path d="M10.5 21v-4a1.5 1.5 0 0 1 3 0v4" fill="${LAPIS}" ${s}/>
    <path d="M7.5 7.2 8.6 3.5l2 2.4L12 2.6l1.4 3.3 2-2.4 1.1 3.7z" fill="${GOLD}" ${s}/>
    <circle cx="12" cy="2.4" r=".9" fill="${CARMINE}" stroke="${INK}" stroke-width=".6"/>`,
  // Walled town with a dome
  city: `<path d="M4 21v-7h3v-2h3v2h4v-2h3v2h3v7z" fill="${PAPER}" ${s}/>
    <path d="M9 12a3 3 0 0 1 6 0" fill="${TURQ}" ${s}/><path d="M12 9V7.5" ${s}/>
    <path d="M10.6 21v-3.2a1.4 1.4 0 0 1 2.8 0V21" fill="${INK}" stroke="none"/>`,
  // Tower on a rock
  fortress: `<path d="M3 21c2-2 4-3 9-3s7 1 9 3z" fill="${GOLD}" ${s}/>
    <path d="M8 18V7h1.4V5h1.6v2h2V5h1.6v2H16v11z" fill="${PAPER}" ${s}/>
    <path d="M11 11h2v3h-2z" fill="${LAPIS}" ${s}/>`,
  // Turquoise dome over a portal
  shrine: `<path d="M5 21v-8h14v8z" fill="${PAPER}" ${s}/>
    <path d="M6.5 13C6.5 8.5 9 6.2 12 5c3 1.2 5.5 3.5 5.5 8z" fill="${TURQ}" ${s}/>
    <path d="M12 5V2.6" ${s}/><circle cx="12" cy="2.3" r=".8" fill="${GOLD}" stroke="${INK}" stroke-width=".6"/>
    <path d="M10 21v-4.2a2 2 0 0 1 4 0V21" fill="${LAPIS}" ${s}/>`,
  // Crossed swords
  battlefield: `<path d="M5 4l10.5 10.5M19 4 8.5 14.5" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M5 4l10.5 10.5M19 4 8.5 14.5" stroke="${PAPER}" stroke-width="1" stroke-linecap="round"/>
    <path d="M14 16.5l3.5-3.5M10 16.5 6.5 13" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/>
    <path d="M16.6 17.4l2.4 2.4M7.4 17.4 5 19.8" stroke="${CARMINE}" stroke-width="2.2" stroke-linecap="round"/>`,
  // Dhow with a lateen sail
  port: `<path d="M3 16h18l-3 4H6z" fill="${GOLD}" ${s}/>
    <path d="M12 16V4" ${s}/><path d="M12 4.5 19 14h-7z" fill="${PAPER}" ${s}/>
    <path d="M12 6 7 14h5z" fill="${CARMINE}" ${s}/>
    <path d="M2 21.5c2-1 4 1 6 0s4 1 6 0 4 1 6 0" stroke="${LAPIS}" stroke-width="1" fill="none" stroke-linecap="round"/>`,
};

export function placeIconSvg(type: PlaceType, size = 22): string {
  return `<svg class="place-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true">${BODIES[type]}</svg>`;
}
