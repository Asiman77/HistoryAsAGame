/** Grades the curriculum covers (FRONTEND_SPEC §1). Shared by server pages and client stores. */
export const GRADES = [6, 7, 8, 9, 10, 11] as const;
export type Grade = (typeof GRADES)[number];

export const isGrade = (v: unknown): v is Grade => typeof v === "number" && (GRADES as readonly number[]).includes(v);
