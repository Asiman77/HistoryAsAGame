import type { Claim, ClaimType, LocalizedText, Source } from "@/domain/schema";

/** Colours of the four kinds; each pairs a dark text colour with a light tint, readable on every theme surface. */
export const CLAIM_STYLE: Record<ClaimType, { fg: string; bg: string; border: string }> = {
  fact: { fg: "#13574f", bg: "#dff1ec", border: "#7fbfb2" },
  disputed: { fg: "#7a4a00", bg: "#fbecc9", border: "#d9a441" },
  legend: { fg: "#5b2d6e", bg: "#efe2f4", border: "#b38cc4" },
  literary: { fg: "#6b4a12", bg: "#f6ead0", border: "#c9a65a" },
};

/** One "Fakt yoxsa rəvayət?" card: a statement the student classifies. */
export interface ClassifyItem {
  id: string;
  statement: LocalizedText;
  answer: Exclude<ClaimType, "literary">;
  explanation: LocalizedText | null;
  source: Source | null;
  /** Where the statement comes from, e.g. the step title, for the explanation. */
  stepTitle: LocalizedText;
}

/** Every classifiable claim of a simulation (literary text is never a quiz statement). */
export function classifyItems(steps: { title: LocalizedText; claims: Claim[] }[]): ClassifyItem[] {
  return steps.flatMap((s) =>
    s.claims
      .filter((c): c is Claim & { claimType: ClassifyItem["answer"] } => c.claimType !== "literary")
      .map((c) => ({
        id: c.id,
        statement: c.text,
        answer: c.claimType,
        explanation: c.why ?? null,
        source: c.firstRecorded?.source ?? c.sources[0] ?? c.versions?.[0]?.sources[0] ?? null,
        stepTitle: s.title,
      })),
  );
}

/**
 * A short round: up to `n` items, mixing kinds so the answer is not always the
 * same. Deterministic for a given seed, so a class sees the same order.
 */
export function pickRound<T extends { answer: string }>(items: T[], n = 6, seed = 1): T[] {
  let x = seed;
  const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const byKind = new Map<string, T[]>();
  for (const it of items) byKind.set(it.answer, [...(byKind.get(it.answer) ?? []), it]);
  for (const list of byKind.values()) list.sort(() => rand() - 0.5);
  const out: T[] = [];
  while (out.length < n && [...byKind.values()].some((l) => l.length)) {
    for (const list of byKind.values()) {
      const it = list.shift();
      if (it && out.length < n) out.push(it);
    }
  }
  return out.sort(() => rand() - 0.5);
}
