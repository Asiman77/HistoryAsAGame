import type { Certainty, ClaimType, EventType, LocalizedText, Mood } from "@/domain/schema";
import { distanceKm } from "./places";

/**
 * Compare mode: two simulations (persons, states, wars) side by side on one
 * time axis. The meeting rules are the backend's `GET /compare` (BACKEND_SPEC.md
 * §10.3, ADR-0015) and are checked against it by scripts/parity-history-queries.ts.
 * "Shared places" (the same place in different years) are a softer,
 * frontend-only level for rivals whose lives do not overlap.
 */

export type OwnerType = "person" | "state" | "conflict";

/** Two steps meet at the same place, or closer than this, in the same year. */
export const MEET_KM = 25;

export interface LaneEvent {
  key: string;
  stepId: string;
  title: LocalizedText;
  date: { year: number; month?: number; day?: number; certainty: Certainty };
  placeId: string | null;
  lat: number;
  lng: number;
  icon: EventType;
  mood: Mood;
  claimType: ClaimType;
  themeId: string;
  /** Deep link without locale. */
  href: string;
  /** Battles the step refers to (by link, or because the war day is the battle), sorted. */
  battles: string[];
}

export interface Lane {
  type: OwnerType;
  id: string;
  title: LocalizedText;
  /** Years of the first and last step, null without steps. */
  fromYear: number | null;
  toYear: number | null;
  events: LaneEvent[];
  /** Line through the lane's steps for the map (smoothed routes where the step is a journey). */
  path: [number, number][];
}

export type MeetReason = "place" | "battle";

export interface Meeting {
  reasons: MeetReason[];
  /** Step id in lane a / lane b. */
  a: string;
  b: string;
  /** Year of the step in lane a. */
  year: number;
  /** Shared catalogue place, null when the steps only lie close together (or meet by battle). */
  placeId: string | null;
  /** Between the two locations, one decimal. */
  distanceKm: number;
  battle: string | null;
}

/** The same catalogue place in both lanes, in years where the two did not meet. */
export interface SharedPlace {
  placeId: string;
  a: { stepId: string; year: number }[];
  b: { stepId: string; year: number }[];
}

export interface Comparison {
  overlap: { from: number; to: number } | null;
  meetings: Meeting[];
  sharedPlaces: SharedPlace[];
}

export const ownerKey = (type: OwnerType, id: string) => `${type}:${id}`;

/** `person:shah-ismayil`, or a bare slug for a person. Null when it is not an owner. */
export function parseOwner(value: string | null | undefined): { type: OwnerType; id: string } | null {
  if (!value) return null;
  const parts = value.trim().split(":");
  if (parts.length === 1) return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(parts[0]!) ? { type: "person", id: parts[0]! } : null;
  const [type, id] = parts;
  if (parts.length !== 2 || !id || !["person", "state", "conflict"].includes(type!)) return null;
  return { type: type as OwnerType, id };
}

export function overlap(a: Lane, b: Lane): Comparison["overlap"] {
  if (a.fromYear === null || b.fromYear === null || a.toYear === null || b.toYear === null) return null;
  const from = Math.max(a.fromYear, b.fromYear);
  const to = Math.min(a.toYear, b.toYear);
  return from <= to ? { from, to } : null;
}

/** Every pair of steps that meets; a pair meeting for both reasons is listed once (backend `CompareReader`). */
export function meetings(a: Lane, b: Lane): Meeting[] {
  const out: Meeting[] = [];
  for (const x of a.events) {
    for (const y of b.events) {
      const reasons: MeetReason[] = [];
      const sharedPlace = x.placeId !== null && x.placeId === y.placeId ? x.placeId : null;
      const km = distanceKm(x, y);
      if (x.date.year === y.date.year && (sharedPlace !== null || km <= MEET_KM)) reasons.push("place");
      const battle = x.battles.find((s) => y.battles.includes(s)) ?? null;
      if (battle) reasons.push("battle");
      if (reasons.length === 0) continue;
      out.push({ reasons, a: x.stepId, b: y.stepId, year: x.date.year, placeId: sharedPlace, distanceKm: Math.round(km * 10) / 10, battle });
    }
  }
  return out;
}

/** Catalogue places both lanes visit, keeping only the visits that are not already a meeting there. */
export function sharedPlaces(a: Lane, b: Lane, met: Meeting[]): SharedPlace[] {
  const metAt = new Set(met.filter((m) => m.placeId).flatMap((m) => [`a:${m.a}`, `b:${m.b}`]));
  const visits = (lane: Lane, side: "a" | "b") => {
    const by = new Map<string, { stepId: string; year: number }[]>();
    for (const e of lane.events) {
      if (!e.placeId || metAt.has(`${side}:${e.stepId}`)) continue;
      by.set(e.placeId, [...(by.get(e.placeId) ?? []), { stepId: e.stepId, year: e.date.year }]);
    }
    return by;
  };
  const va = visits(a, "a");
  const vb = visits(b, "b");
  return [...va.keys()]
    .filter((id) => vb.has(id))
    .map((placeId) => ({ placeId, a: va.get(placeId)!, b: vb.get(placeId)! }))
    .sort((x, y) => x.a[0]!.year - y.a[0]!.year || x.placeId.localeCompare(y.placeId));
}

export function compareLanes(a: Lane, b: Lane): Comparison {
  const met = meetings(a, b);
  return { overlap: overlap(a, b), meetings: met, sharedPlaces: sharedPlaces(a, b, met) };
}

/** Shared year axis: both lanes, padded to whole decades. */
export function axisRange(a: Lane, b: Lane): { from: number; to: number } {
  const years = [a.fromYear, a.toYear, b.fromYear, b.toYear].filter((y): y is number => y !== null);
  if (years.length === 0) return { from: 0, to: 10 };
  const from = Math.floor(Math.min(...years) / 10) * 10;
  const to = Math.ceil((Math.max(...years) + 1) / 10) * 10;
  return { from, to: Math.max(to, from + 10) };
}
