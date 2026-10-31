import { z } from "zod";

/**
 * Single source of truth for the content model. Every JSON file under data/
 * is parsed with these schemas, and TypeScript types are inferred from them.
 */

export const LOCALES = ["az", "en", "ru"] as const;
export const DEFAULT_LOCALE = "az" satisfies Locale;
export type Locale = (typeof LOCALES)[number];

/** Translatable text. Azerbaijani is mandatory, other locales fall back to it. */
export const LocalizedText = z.object({
  az: z.string().min(1),
  en: z.string().min(1).optional(),
  ru: z.string().min(1).optional(),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case id gözlənilir");

export const Certainty = z.enum(["exact", "approximate", "disputed"]);
export type Certainty = z.infer<typeof Certainty>;

const DateParts = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
});

export const Source = z.object({
  title: z.string().min(1),
  author: z.string().optional(),
  url: z.url().optional(),
  type: z.enum(["book", "article", "encyclopedia", "web", "primary"]),
  /** Page, chapter or a short remark on what the source supports. */
  note: z.string().optional(),
});
export type Source = z.infer<typeof Source>;

/** Gregorian date with explicit precision and certainty. */
export const HistoricalDate = DateParts.extend({
  certainty: Certainty,
  alternatives: z
    .array(DateParts.extend({ note: LocalizedText, source: Source.optional() }))
    .optional(),
  note: LocalizedText.optional(),
}).refine((d) => d.day === undefined || d.month !== undefined, {
  message: "gün göstərilibsə, ay da göstərilməlidir",
});
export type HistoricalDate = z.infer<typeof HistoricalDate>;

export const Place = z.object({
  /** Name as it was used in the period of the event. */
  name: LocalizedText,
  /** Present-day name/location, shown in learning mode to avoid confusion. */
  modernName: LocalizedText.optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Location itself is approximate (e.g. a battlefield whose exact site is unknown). */
  approximate: z.boolean().optional(),
});
export type Place = z.infer<typeof Place>;

export const EVENT_TYPES = [
  "birth",
  "childhood",
  "education",
  "journey",
  "battle",
  "coronation",
  "marriage",
  "diplomacy",
  "culture",
  "exile",
  "death",
] as const;
export const EventType = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventType>;

export const BattleOutcome = z.object({
  result: z.enum(["victory", "defeat", "inconclusive"]),
  opponent: LocalizedText,
  /** Forces of each side, if known. Numbers in chronicles are often inflated. */
  forces: z.object({ own: LocalizedText.optional(), enemy: LocalizedText.optional() }).optional(),
  context: LocalizedText,
});
export type BattleOutcome = z.infer<typeof BattleOutcome>;

export const Choice = z
  .object({
    prompt: LocalizedText,
    options: z
      .array(z.object({ text: LocalizedText, explanation: LocalizedText }))
      .min(2)
      .max(4),
    historicalOptionIndex: z.number().int().min(0),
    /** Why the historical choice was made. */
    why: LocalizedText,
  })
  .refine((c) => c.historicalOptionIndex < c.options.length, {
    message: "historicalOptionIndex variantların sayından kiçik olmalıdır",
  });
export type Choice = z.infer<typeof Choice>;

export const QuizQuestion = z
  .object({
    question: LocalizedText,
    options: z.array(LocalizedText).min(2).max(5),
    correctIndex: z.number().int().min(0),
    explanation: LocalizedText,
  })
  .refine((q) => q.correctIndex < q.options.length, {
    message: "correctIndex variantların sayından kiçik olmalıdır",
  });
export type QuizQuestion = z.infer<typeof QuizQuestion>;

const LngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

export const LifeEvent = z.object({
  id: Slug,
  personId: Slug,
  order: z.number().int().min(0),
  date: HistoricalDate,
  type: EventType,
  location: Place,
  /** Present when the person moves between places in this event. */
  fromLocation: Place.optional(),
  /** Optional intermediate waypoints [lng, lat] between fromLocation and location. */
  route: z.array(LngLat).optional(),
  title: LocalizedText,
  /** Verified historical facts only. */
  factualSummary: LocalizedText,
  /** First-person literary text. Dramatisation, never presented as fact. */
  narrative: LocalizedText,
  outcome: BattleOutcome.optional(),
  sources: z.array(Source).min(1),
  choice: Choice.optional(),
  quiz: z.array(QuizQuestion).min(1).max(3).optional(),
});
export type LifeEvent = z.infer<typeof LifeEvent>;

export const EventsFile = z.object({ events: z.array(LifeEvent).min(1) });

export const ImageAsset = z.object({
  /** Path under public/ or an absolute URL. */
  src: z.string().min(1),
  alt: LocalizedText,
  license: z.string().min(1),
  author: z.string().optional(),
  sourceUrl: z.url().optional(),
});
export type ImageAsset = z.infer<typeof ImageAsset>;

export const Person = z.object({
  id: Slug,
  name: LocalizedText,
  /** Used in running text, e.g. "Gözünü Şah İsmayıl olaraq aç". Falls back to name. */
  shortName: LocalizedText.optional(),
  titles: z.array(LocalizedText),
  birth: z.object({ date: HistoricalDate, place: Place }),
  death: z.object({ date: HistoricalDate, place: Place }),
  eraIds: z.array(Slug).min(1),
  portrait: ImageAsset.optional(),
  /** Short motto/quote for the landing card. */
  epigraph: z.object({ text: LocalizedText, attribution: LocalizedText }).optional(),
  shortBio: LocalizedText,
  /** Shown on the final screen. */
  legacy: LocalizedText,
  tags: z.array(Slug),
  /** Sort hint for the landing grid; falls back to birth year. */
  featuredOrder: z.number().int().optional(),
});
export type Person = z.infer<typeof Person>;

export const Era = z.object({
  id: Slug,
  name: LocalizedText,
  startYear: z.number().int(),
  endYear: z.number().int(),
  description: LocalizedText,
  theme: z.object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
});
export type Era = z.infer<typeof Era>;

export const RELATION_TYPES = [
  "parent",
  "grandparent",
  "spouse",
  "sibling",
  "ally",
  "rival",
  "successor",
  "contemporary",
] as const;

/** Directed relation: `from` is <type> of `to` (e.g. Uzun Həsən is grandparent of İsmayıl). */
export const Relation = z.object({
  from: Slug,
  to: Slug,
  type: z.enum(RELATION_TYPES),
  note: LocalizedText.optional(),
  sources: z.array(Source).optional(),
});
export type Relation = z.infer<typeof Relation>;

export const RelationsFile = z.object({ relations: z.array(Relation) });

export const GlossaryEntry = z.object({
  id: Slug,
  term: LocalizedText,
  definition: LocalizedText,
});
export const GlossaryFile = z.object({ entries: z.array(GlossaryEntry) });
export type GlossaryEntry = z.infer<typeof GlossaryEntry>;
