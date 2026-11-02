import { booleanPointInPolygon, point } from "@turf/turf";
import type { Certainty, LocalizedText, TerritorySnapshot } from "@/domain/schema";

/** A run of years in which a place lay inside one polity (or outside every drawn one). */
export type MembershipSpan =
  | {
      kind: "polity";
      from: number;
      to: number;
      polityId: string;
      name: LocalizedText;
      color: string;
      /** The place was this polity's capital in the snapshot. */
      capital: boolean;
      vassalOf?: string;
      certainty: Certainty;
    }
  /** Years without a snapshot close enough to say anything. */
  | { kind: "gap"; from: number; to: number };

/** A snapshot stands for the years after it up to the next one, but never longer than this. */
export const SNAPSHOT_REACH_YEARS = 30;

/**
 * Which polity held a point in each period, from the drawn snapshots
 * (point-in-polygon at build time). Consecutive snapshots with the same
 * owner merge into one span; long stretches without snapshots become gaps,
 * so the page never pretends to know more than the maps do.
 */
export function placeMembership(placeId: string, lngLat: [number, number], snapshots: TerritorySnapshot[]): MembershipSpan[] {
  const sorted = [...snapshots].sort((a, b) => a.year - b.year);
  const pt = point(lngLat);
  const spans: MembershipSpan[] = [];
  sorted.forEach((s, i) => {
    const next = sorted[i + 1];
    const reach = Math.min(next ? next.year - 1 : s.year, s.year + SNAPSHOT_REACH_YEARS);
    const owner = s.polities.find((p) => booleanPointInPolygon(pt, { type: "Feature", properties: {}, geometry: p.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon }));
    const last = spans.at(-1);
    if (owner) {
      const capital = owner.capitalId === placeId;
      const span: MembershipSpan = {
        kind: "polity",
        from: s.year,
        to: reach,
        polityId: owner.id,
        name: owner.name,
        color: owner.color,
        capital,
        ...(owner.vassalOf ? { vassalOf: owner.vassalOf } : {}),
        certainty: s.certainty,
      };
      if (last?.kind === "polity" && last.polityId === owner.id && last.capital === capital && last.to >= s.year - 1) last.to = reach;
      else spans.push(span);
    }
    if (next && reach < next.year - 1) spans.push({ kind: "gap", from: reach + 1, to: next.year - 1 });
  });
  return spans;
}

/** Keep only the years the place existed (Şuşa from 1752), trimming spans at the edges. */
export function clipToLifetime(spans: MembershipSpan[], periods: { from: number; to: number }[]): MembershipSpan[] {
  const from = Math.min(...periods.map((p) => p.from));
  const to = Math.max(...periods.map((p) => p.to));
  return spans
    .filter((s) => s.to >= from && s.from <= to)
    .map((s) => ({ ...s, from: Math.max(s.from, from), to: Math.min(s.to, to) }))
    .filter((s, i, all) => !(s.kind === "gap" && (i === 0 || i === all.length - 1)));
}

