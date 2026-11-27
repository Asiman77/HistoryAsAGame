import type { ZamanGrade } from "./data";

/** The years of a grade with some air around them, inside the axis. */
export function gradeView(g: Pick<ZamanGrade, "from" | "to">, from: number, to: number): [number, number] {
  const pad = Math.max(10, Math.round((g.to - g.from) * 0.15));
  return [Math.max(from, g.from - pad), Math.min(to, g.to + pad)];
}
