/**
 * Data of the timeline screen (/zaman/, FRONTEND_SPEC §6.2), resolved at build
 * time for the page's locale. Nothing is written by hand: eras come with their
 * weights, the lanes are the states on Azerbaijani lands as the maps draw them,
 * the events of every simulation and the lives of the persons.
 */
import { DEFAULT_SUBJECT, type Locale, type TerritorySnapshotMeta } from "@/domain/schema";
import type { HistoryRepository } from "@/data/repository";
import { loadPoliticalContext } from "@/data/political";
import { resolvePolitical, type PanelPolitical } from "@/features/ruler-panel/data";
import { t } from "@/lib/i18n";
import { SNAPSHOT_REACH_YEARS } from "@/lib/placeHistory";
import { DEFAULT_THEME_ID, eraForYear } from "@/lib/theme";
import { eraSegments, type TimeSegment } from "@/lib/timeScale";
import { contrast } from "@/theme/color";
import { MIN_TEXT_CONTRAST, tokensForTheme } from "@/theme/resolve";
import { BASE_THEME_TOKENS } from "@/theme/tokens";

/** [lng, lat] */
type LngLat = [number, number];

export interface ZamanEra {
  id: string;
  name: string;
  from: number;
  to: number;
  weight: number;
  themeId: string;
  /** The era's colour (its theme's second colour): bands, lanes. */
  color: string;
  /** The band is light (2020's flag blue): its label is dark, for contrast. */
  lightBand: boolean;
  mapVariant: "manuscript" | "miniature" | "military" | "modern";
}

export interface ZamanEvent {
  key: string;
  year: number;
  title: string;
  /** The simulation it belongs to ("Şah İsmayıl Xətai"). */
  entity: string;
  href: string;
  category: "person" | "battle" | "state";
  legend: boolean;
  center: LngLat;
}

export interface ZamanPerson {
  id: string;
  name: string;
  from: number;
  to: number;
  approximate: boolean;
  href: string;
  color: string;
}

/**
 * A state on Azerbaijani lands in the years the maps show it there, on a row
 * of the lane. When more states share the years than the lane has rows (the
 * khanates), the rest are one bar that names them all (`polityId` null).
 */
export interface ZamanStateBar {
  polityId: string | null;
  name: string;
  color: string;
  from: number;
  to: number;
  row: number;
  /** Names of the states in a grouped bar. */
  group?: string[];
}

/** Rows of the states lane; the last one holds the states that do not fit. */
export const STATE_ROWS = 3;

export interface ZamanSnapshot {
  id: string;
  year: number;
  polities: { id: string; name: string; color: string; capitalId?: string; vassalOf?: string }[];
}

export interface ZamanCapital {
  id: string;
  center: LngLat;
  periods: { from: number; to: number; name: string }[];
  modern: string | null;
}

export interface ZamanData {
  subject: string;
  from: number;
  to: number;
  eras: ZamanEra[];
  segments: TimeSegment[];
  events: ZamanEvent[];
  persons: ZamanPerson[];
  states: ZamanStateBar[];
  stateRows: number;
  snapshots: ZamanSnapshot[];
  capitals: ZamanCapital[];
  political: PanelPolitical;
  /** Opened without ?year=: the year of the first event. */
  defaultYear: number;
}

/**
 * Regions of the territory registry (data/territories/registry.json) that make
 * up the historical lands of Azerbaijan, north and south of the Araz: the
 * "azerbaijan" (Təbriz) and "shirvan" groups and the regions between them.
 * A polity holding any of them in a snapshot gets a bar in the states lane.
 */
export const AZERBAIJAN_REGIONS: ReadonlySet<string> = new Set([
  "azerbaijan", "tabriz-r", "khoy-r", "urmia-r", "maragha-r", "qaradagh-r", "ardabil",
  "shirvan", "shamakhi-r", "quba-r", "absheron", "shaki", "ganja", "karabakh", "mughan", "talysh", "nakhchivan",
]);
const AZERBAIJAN_ISO = "AZE";

/** Spans of the polities holding Azerbaijani lands, snapshot by snapshot, packed into as few rows as possible. */
export function stateBars(snapshots: readonly TerritorySnapshotMeta[], to: number, name: (s: TerritorySnapshotMeta["polities"][number]) => string): { bars: ZamanStateBar[]; rows: number } {
  const sorted = [...snapshots].sort((a, b) => a.year - b.year);
  const spans: Omit<ZamanStateBar, "row">[] = [];
  sorted.forEach((s, i) => {
    const next = sorted[i + 1];
    const until = Math.min(next ? next.year - 1 : to, s.year + SNAPSHOT_REACH_YEARS, to);
    for (const p of s.polities) {
      const holds = p.iso === AZERBAIJAN_ISO || (p.regions ?? []).some((r) => AZERBAIJAN_REGIONS.has(r));
      if (!holds) continue;
      const last = [...spans].reverse().find((x) => x.polityId === p.id);
      if (last && s.year <= last.to + 1) last.to = Math.max(last.to, until);
      else spans.push({ polityId: p.id, name: name(p), color: p.color, from: s.year, to: until });
    }
  });
  // Greedy packing into the first rows; what does not fit goes to grouped bars on the last row.
  const rowEnds: number[] = [];
  const bars: ZamanStateBar[] = [];
  const rest: Omit<ZamanStateBar, "row">[] = [];
  for (const span of spans.sort((a, b) => a.from - b.from || b.to - a.to)) {
    let row = rowEnds.findIndex((end) => end < span.from);
    if (row < 0 && rowEnds.length < STATE_ROWS - 1) row = rowEnds.push(span.to) - 1;
    else if (row >= 0) rowEnds[row] = span.to;
    if (row < 0) rest.push(span);
    else bars.push({ ...span, row });
  }
  const groups: ZamanStateBar[] = [];
  for (const span of rest) {
    const g = groups.find((x) => span.from <= x.to && span.to >= x.from);
    if (g) {
      g.from = Math.min(g.from, span.from);
      g.to = Math.max(g.to, span.to);
      if (!g.group!.includes(span.name)) g.group!.push(span.name);
    } else groups.push({ ...span, polityId: null, row: STATE_ROWS - 1, group: [span.name] });
  }
  // A group of one is just that state.
  for (const g of groups) bars.push(g.group!.length === 1 ? { ...rest.find((r) => r.name === g.group![0])!, row: g.row } : g);
  return { bars, rows: Math.max(rowEnds.length, groups.length ? STATE_ROWS : 0) };
}

export async function loadZamanData(repo: HistoryRepository, locale: Locale, subject = DEFAULT_SUBJECT): Promise<ZamanData> {
  const tr = (x: Parameters<typeof t>[0]) => t(x, locale);
  const [allEras, themes, snapshots, places, index, persons] = await Promise.all([
    repo.listEras(),
    repo.listThemes(),
    repo.listTerritorySnapshots(),
    repo.listPlaces(),
    repo.getHistoryIndex(),
    repo.listPersons(),
  ]);
  const eras = allEras.filter((e) => (e.subject ?? DEFAULT_SUBJECT) === subject).sort((a, b) => a.startYear - b.startYear);
  const segments = eraSegments(eras.map((e) => ({ id: e.id, startYear: e.startYear, endYear: e.endYear, weight: e.weight })));
  const from = segments[0]?.from ?? 0;
  const to = segments.at(-1)?.to ?? 0;
  const themeColor = (themeId: string | undefined) => {
    const th = themes[themeId ?? DEFAULT_THEME_ID];
    return tokensForTheme(themeId ?? DEFAULT_THEME_ID, th?.ui, th?.palette.primary).secondary;
  };

  const capitalIds = new Set(snapshots.flatMap((s) => s.polities.flatMap((p) => (p.capitalId ? [p.capitalId] : []))));
  const capitalPlaces = places.filter((p) => capitalIds.has(p.id));
  const political = await loadPoliticalContext(repo, from, to);
  const { bars, rows } = stateBars(snapshots, to, (p) => tr(p.name));

  const events: ZamanEvent[] = index
    .filter((e) => e.date.year >= from && e.date.year <= to)
    .map((e) => ({
      key: e.key,
      year: e.date.year,
      title: tr(e.title),
      entity: tr(e.entityTitle),
      href: e.href,
      category: e.category,
      legend: e.claimType === "legend",
      center: [e.lng, e.lat],
    }));

  return {
    subject,
    from,
    to,
    eras: eras.map((e) => ({
      id: e.id,
      name: tr(e.name),
      from: e.startYear,
      to: e.endYear,
      weight: e.weight ?? 1,
      themeId: e.themeId,
      color: themeColor(e.themeId),
      lightBand: contrast(themeColor(e.themeId), BASE_THEME_TOKENS["text-primary"]) < MIN_TEXT_CONTRAST,
      mapVariant: themes[e.themeId]?.mapStyleVariant ?? "manuscript",
    })),
    segments,
    events,
    persons: persons
      .filter((p) => p.death.date.year >= from && p.birth.date.year <= to)
      .map((p) => {
        const era = eraForYear(allEras, p.death.date.year);
        return {
          id: p.id,
          name: tr(p.shortName ?? p.name),
          from: p.birth.date.year,
          to: p.death.date.year,
          approximate: p.birth.date.certainty !== "exact" || p.death.date.certainty !== "exact",
          href: `/sexsiyyetler/${p.id}/`,
          color: themeColor(p.themeId ?? era?.themeId),
        };
      }),
    states: bars,
    stateRows: rows,
    snapshots: snapshots.map((s) => ({
      id: s.id,
      year: s.year,
      polities: s.polities.map((p) => ({
        id: p.id,
        name: tr(p.name),
        color: p.color,
        ...(p.capitalId ? { capitalId: p.capitalId } : {}),
        ...(p.vassalOf ? { vassalOf: p.vassalOf } : {}),
      })),
    })),
    capitals: capitalPlaces.map((p) => ({
      id: p.id,
      center: [p.lng, p.lat],
      periods: p.periods.map((r) => ({ from: r.from, to: r.to, name: tr(r.name ?? p.names.historical) })),
      modern: p.names.modern ? tr(p.names.modern) : null,
    })),
    political: resolvePolitical(political, capitalPlaces, locale),
    defaultYear: Math.min(...events.map((e) => e.year), to),
  };
}
