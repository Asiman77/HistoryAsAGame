/**
 * Class codes (ADR-0016): six characters a teacher gives out, without the
 * letters and digits that are easy to confuse (I, L, O, 0, 1).
 */
export const CLASS_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

/** "k7mq2x " → "K7MQ2X"; null when it is not a class code. */
export function normalizeClassCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.replace(/[\s-]/g, "").toUpperCase();
  return CLASS_CODE.test(code) ? code : null;
}
