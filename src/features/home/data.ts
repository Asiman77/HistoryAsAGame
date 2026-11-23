/**
 * Build-time data of the home page sections that are not collection cards.
 * Every label comes from the repository.
 */
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { t } from "@/lib/i18n";
import { DEFAULT_THEME_ID } from "@/lib/theme";
import { SLIDER_FROM, SLIDER_TO, eraSegments } from "@/lib/timeSlider";
import { tokensForTheme } from "@/theme/resolve";

export interface RoutePoint {
  place: string;
  year: number;
}

/**
 * The sample route drawn across the hero sky (§6.1): birth place → place of
 * the coronation of the first featured person who has one.
 */
export async function heroRoute(locale: Locale): Promise<[RoutePoint, RoutePoint] | null> {
  const repo = getRepository();
  const persons = [...(await repo.listPersons())].sort((a, b) => (a.featuredOrder ?? a.birth.date.year) - (b.featuredOrder ?? b.birth.date.year));
  for (const p of persons) {
    const events = await repo.getEvents(p.id);
    const birth = events.find((e) => e.type === "birth");
    const crowned = events.find((e) => e.type === "coronation");
    if (birth && crowned) {
      return [
        { place: t(birth.location.name, locale), year: birth.date.year },
        { place: t(crowned.location.name, locale), year: crowned.date.year },
      ];
    }
  }
  return null;
}

export interface PreviewEra {
  name: string | null;
  color: string | null;
  from: number;
  to: number;
}

export interface PreviewReign {
  polity: string;
  ruler: string;
  color: string;
  from: number;
  to: number;
}

export interface TimelinePreviewData {
  from: number;
  to: number;
  eras: PreviewEra[];
  reigns: PreviewReign[];
}

/** Era bands (gaps stay uncoloured) and who ruled where, for the home page slider. */
export async function timelinePreview(locale: Locale): Promise<TimelinePreviewData> {
  const repo = getRepository();
  const [eras, reigns, rulers, polities] = await Promise.all([repo.listEras(), repo.listReigns(), repo.listRulers(), repo.listPolities()]);
  const views = eras.map((e) => ({ ...e, color: tokensForTheme(e.themeId ?? DEFAULT_THEME_ID).secondary }));
  const segments = eraSegments(views, SLIDER_FROM, SLIDER_TO).map((s) =>
    s.kind === "era" ? { name: t(s.era.name, locale), color: s.era.color, from: s.from, to: s.to } : { name: null, color: null, from: s.from, to: s.to },
  );
  const polityById = new Map(polities.map((p) => [p.id, p]));
  const rulerById = new Map(rulers.map((r) => [r.id, r]));
  const out: PreviewReign[] = [];
  for (const r of reigns) {
    const polity = polityById.get(r.polityId);
    const ruler = rulerById.get(r.rulerId);
    if (!polity || !ruler) continue;
    out.push({ polity: t(polity.name, locale), ruler: t(ruler.name, locale), color: polity.color, from: r.start.year, to: r.end.year });
  }
  return { from: SLIDER_FROM, to: SLIDER_TO, eras: segments, reigns: out };
}
