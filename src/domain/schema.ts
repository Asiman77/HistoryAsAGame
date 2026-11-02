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
const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// ---------------------------------------------------------------------------
// Cross-entity references
// ---------------------------------------------------------------------------

export const ENTITY_TYPES = ["person", "conflict", "battle", "state", "place", "ruler"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Pointer to any entity, optionally to one step of its simulation. A ref to an
 * entity that does not exist yet stays in the data and shows as "tezliklə";
 * it becomes a live link as soon as the entity is added.
 */
export const EntityRef = z.object({
  type: z.enum(ENTITY_TYPES),
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  /** Step inside the target simulation (event id, war day id, state step id). */
  stepId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).optional(),
  /** Why the two are connected, shown on the chip or card. */
  note: z.lazy(() => LocalizedText).optional(),
  /** Display name when the target is not in the registry yet. */
  label: z.lazy(() => LocalizedText).optional(),
});
export type EntityRef = z.infer<typeof EntityRef>;

/** Entities announced before their data exists: passive chips and "tezliklə" cards use these names. */
export const PlannedFile = z.object({
  entities: z.array(
    z.object({
      type: z.enum(ENTITY_TYPES),
      id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
      title: z.lazy(() => LocalizedText),
      description: z.lazy(() => LocalizedText).optional(),
      years: z.string().optional(),
    }),
  ),
});
export type PlannedEntity = z.infer<typeof PlannedFile>["entities"][number];

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
  type: z.enum(["book", "article", "encyclopedia", "web", "primary", "dataset"]),
  /** Page, chapter or a short remark on what the source supports. */
  note: z.string().optional(),
});
export type Source = z.infer<typeof Source>;

// ---------------------------------------------------------------------------
// Fact and legend
// ---------------------------------------------------------------------------

/**
 * fact: confirmed by sources. disputed: historians give different versions.
 * legend: folk tradition or a story that appears in later sources.
 * literary: dramatic text written for story mode, not a historical claim.
 */
export const CLAIM_TYPES = ["fact", "disputed", "legend", "literary"] as const;
export const ClaimType = z.enum(CLAIM_TYPES);
export type ClaimType = z.infer<typeof ClaimType>;

export const Claim = z
  .object({
    id: Slug,
    claimType: ClaimType,
    /** The statement itself, as a student would read it. */
    text: LocalizedText,
    /** Why it has this type ("Bu niyə rəvayət sayılır?"). */
    why: LocalizedText.optional(),
    sources: z.array(Source),
    /** Where a legend was first written down, as far as is known. */
    firstRecorded: z.object({ source: Source, year: z.number().int().optional(), note: LocalizedText.optional() }).optional(),
    /** Competing versions of a disputed point (a legend may have variants too). */
    versions: z.array(z.object({ text: LocalizedText, sources: z.array(Source).min(1) })).optional(),
  })
  .refine((c) => c.claimType !== "fact" || c.sources.length > 0, { message: "fakt mənbəsiz ola bilməz" })
  .refine((c) => c.claimType !== "legend" || !!c.firstRecorded, { message: "rəvayət üçün ilk qeyd (firstRecorded) lazımdır" })
  .refine((c) => c.claimType !== "disputed" || (c.versions?.length ?? 0) >= 2, { message: "mübahisəli iddia üçün ən azı iki versiya lazımdır" })
  .refine((c) => c.claimType === "literary" || !!c.why || c.claimType === "fact", { message: "mübahisəli və rəvayət iddiası üçün 'why' izahı lazımdır" });
export type Claim = z.infer<typeof Claim>;

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

const LngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

/** Where an event happens. The richer catalogue of places is `Place` (data/places.json). */
export const Location = z.object({
  /** Name as it was used in the period of the event. */
  name: LocalizedText,
  /** Present-day name/location, shown in learning mode to avoid confusion. */
  modernName: LocalizedText.optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Location itself is approximate (e.g. a battlefield whose exact site is unknown). */
  approximate: z.boolean().optional(),
  /** Catalogue place this location belongs to. When omitted, the nearest place within 30 km is used. */
  placeId: Slug.optional(),
});
export type Location = z.infer<typeof Location>;

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

/** Emotional tone of an event. Drives music, ambience, map colour grading and the UI accent. */
export const MOODS = [
  "birth",
  "childhood",
  "hardship",
  "exile",
  "journey",
  "rise",
  "coronation",
  "battle",
  "victory",
  "defeat",
  "peace",
  "diplomacy",
  "culture",
  "decline",
  "death",
] as const;
export const Mood = z.enum(MOODS);
export type Mood = z.infer<typeof Mood>;

/**
 * Schematic movement of one side in a battle, drawn as an animated arrow.
 * Only directions supported by the sources (approach, flight) should be drawn.
 */
export const Maneuver = z.object({
  side: z.enum(["own", "enemy"]),
  kind: z.enum(["advance", "attack", "flank", "retreat"]),
  /** [lng, lat] points, at least two. */
  path: z.array(LngLat).min(2),
  label: LocalizedText.optional(),
});
export type Maneuver = z.infer<typeof Maneuver>;

export const BattleOutcome = z.object({
  result: z.enum(["victory", "defeat", "inconclusive"]),
  /** The person's side, e.g. "Qızılbaşlar". */
  ownSide: LocalizedText,
  /** The opposing side as a whole, e.g. "Osmanlı ordusu". */
  enemySide: LocalizedText,
  opponent: LocalizedText,
  commanders: z.object({ own: z.array(LocalizedText).min(1), enemy: z.array(LocalizedText).min(1) }),
  /** Forces of each side, if known. Numbers in chronicles are often inflated: give ranges. */
  forces: z.object({ own: LocalizedText.optional(), enemy: LocalizedText.optional() }).optional(),
  /** Where the force numbers come from. Falls back to the event's first source. */
  forcesSource: Source.optional(),
  /** Historical significance of the result. */
  context: LocalizedText,
  /** Polities from the territory registry; used to colour the arrows. */
  ownPolityId: Slug.optional(),
  enemyPolityId: Slug.optional(),
  /** Gunpowder artillery was a notable factor (drives the sound design only). */
  artillery: z.boolean().optional(),
  maneuvers: z.array(Maneuver).optional(),
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

/** A timed subtitle line for narration audio, in seconds. */
export const NarrationCue = z
  .object({ start: z.number().min(0), end: z.number().min(0), text: LocalizedText })
  .refine((c) => c.end > c.start, { message: "end start-dan böyük olmalıdır" });
export type NarrationCue = z.infer<typeof NarrationCue>;

/** Recorded or synthesised narration of the story text. Reserved: no event ships one yet. */
export const NarrationAudio = z.object({
  /** Paths under public/ without extension; `.webm` and `.mp3` are tried in that order. */
  src: z.string().min(1),
  cues: z.array(NarrationCue).min(1),
  license: z.string().min(1),
  voice: z.string().optional(),
});
export type NarrationAudio = z.infer<typeof NarrationAudio>;

/** Short excerpt from a primary source, e.g. a poem or a traveller's account. */
export const PrimaryExcerpt = z.object({
  /** Original wording, when it is public domain. */
  original: z.string().optional(),
  /** Text shown to the student (modern Azerbaijani). */
  text: LocalizedText,
  /** Author and work, e.g. "Ambrogio Contarini, Səyahətnamə (1487)". */
  attribution: LocalizedText,
  /** Licence of the shown text, e.g. "Public domain (1873 tərcüməsi)". */
  license: z.string().min(1),
  /** Who translated the shown text, when it is a translation. */
  translator: z.string().optional(),
  /** Historian's remark, e.g. where the eyewitness is mistaken. */
  note: LocalizedText.optional(),
  source: Source,
});
export type PrimaryExcerpt = z.infer<typeof PrimaryExcerpt>;

export const LifeEvent = z.object({
  id: Slug,
  personId: Slug,
  order: z.number().int().min(0),
  date: HistoricalDate,
  type: EventType,
  mood: Mood,
  location: Location,
  /** Present when the person moves between places in this event. */
  fromLocation: Location.optional(),
  /** Optional intermediate waypoints [lng, lat] between fromLocation and location. */
  route: z.array(LngLat).optional(),
  /** Political map to show. When omitted, chosen by year (see lib/territory.ts). */
  territorySnapshotId: Slug.optional(),
  title: LocalizedText,
  /** Verified historical facts only. */
  factualSummary: LocalizedText,
  /** First-person literary text. Dramatisation, never presented as fact. */
  narrative: LocalizedText,
  outcome: BattleOutcome.optional(),
  sources: z.array(Source).min(1),
  choice: Choice.optional(),
  quiz: z.array(QuizQuestion).min(1).max(3).optional(),
  narrationAudio: NarrationAudio.optional(),
  primarySource: PrimaryExcerpt.optional(),
  /** Other persons, battles, states, places and rulers this event connects to. */
  related: z.array(EntityRef).optional(),
  /** Theme variant for this step only, e.g. the Indian campaign (data/themes). */
  themeId: Slug.optional(),
  /** What kind of statement the step as a whole is (default "fact"; the narrative is always "literary"). */
  claimType: ClaimType.optional(),
  /** Individual statements classified as fact, disputed, legend or literary. */
  claims: z.array(Claim).optional(),
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

export const PortraitKind = z.enum(["historical", "artwork", "ai_illustration"]);
export type PortraitKind = z.infer<typeof PortraitKind>;

/**
 * A portrait for an age range of a person's life. `historical` = made in the
 * person's lifetime, `artwork` = a later artist's work, `ai_illustration` =
 * an AI-generated imagining (historical persons only, always captioned).
 * Without `src` the card shows a respectful placeholder until the file exists.
 */
export const AgePortrait = z
  .object({
    ageFrom: z.number().int().min(0),
    ageTo: z.number().int().min(0),
    kind: PortraitKind,
    src: z.string().min(1).optional(),
    alt: LocalizedText,
    caption: LocalizedText.optional(),
    source: z.string().optional(),
    sourceUrl: z.url().optional(),
    license: z.string().optional(),
    author: z.string().optional(),
    /** Heading id in docs/portrait-prompts.md (AI illustrations). */
    promptId: Slug.optional(),
  })
  .refine((p) => p.ageFrom <= p.ageTo, { message: "ageFrom ≤ ageTo olmalıdır" });
export type AgePortrait = z.infer<typeof AgePortrait>;

export const Person = z.object({
  id: Slug,
  name: LocalizedText,
  /** Used in running text, e.g. "Gözünü Şah İsmayıl olaraq aç". Falls back to name. */
  shortName: LocalizedText.optional(),
  titles: z.array(LocalizedText),
  birth: z.object({ date: HistoricalDate, place: Location }),
  death: z.object({ date: HistoricalDate, place: Location }),
  eraIds: z.array(Slug).min(1),
  /** Overrides the era's theme (data/themes). */
  themeId: Slug.optional(),
  portrait: ImageAsset.optional(),
  /** Portraits by age, shown on a card that changes as the story goes on. */
  portraits: z.array(AgePortrait).optional(),
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
  /** Visual theme (data/themes/<id>.json). Persons, states and wars of the era inherit it. */
  themeId: Slug,
});
export type Era = z.infer<typeof Era>;

// ---------------------------------------------------------------------------
// Themes: the look and feel of a period, kept in data, never in components
// ---------------------------------------------------------------------------

/**
 * Fonts the app loads (next/font needs static calls, so the list lives in code:
 * src/app/layout.tsx). Every one is checked to carry ə Ə ğ ı İ ş ç ö ü.
 */
export const FONT_KEYS = [
  "noto-serif-display",
  "noto-serif",
  "noto-sans",
  "cormorant-garamond",
  "alegreya-sc",
  "spectral-sc",
  "montserrat",
] as const;
export const FontKey = z.enum(FONT_KEYS);
export type FontKey = z.infer<typeof FontKey>;

export const TEXTURES = ["parchment", "manuscript", "linen", "canvas", "stone", "clean"] as const;
export const BORDER_ORNAMENTS = ["none", "double-rule", "girih", "islimi", "bronze-rule", "flag-stripe"] as const;
export const DIVIDER_ORNAMENTS = ["star", "girih-knot", "cloud-band", "dagger", "eight-point-star"] as const;
export const CORNER_ORNAMENTS = ["none", "rosette", "tile-corner", "carpet-medallion", "rivet", "star-corner"] as const;
export const AMBIENT_EFFECTS = ["none", "dust", "candle", "embers", "mist"] as const;
export const MAP_STYLE_VARIANTS = ["manuscript", "miniature", "military", "modern"] as const;
/** Illustrations drawn in code (SVG), for periods without suitable public-domain art. */
export const PROCEDURAL_ART = ["karabakh-mountains"] as const;

export const BackgroundArt = z
  .object({
    /** Path under public/ without extension; `.avif` and `.webp` (plus `-sm` variants) must exist. */
    src: z.string().regex(/^\/[a-z0-9/-]+$/).optional(),
    /** Drawn in code instead of an image file. */
    procedural: z.enum(PROCEDURAL_ART).optional(),
    kind: z.enum(["public_domain", "own", "ai_illustration", "placeholder"]),
    title: LocalizedText,
    /** Collection and object, e.g. "The Met, 452111". */
    source: z.string().min(1),
    sourceUrl: z.url().optional(),
    license: z.string().min(1),
    /** CSS object-position of the part that should stay in view, e.g. "50% 35%". */
    focus: z.string().optional(),
    /** Heading id in docs/background-prompts.md (AI illustrations and placeholders). */
    promptId: Slug.optional(),
  })
  .refine((a) => a.kind === "placeholder" || !!a.src !== !!a.procedural, {
    message: "şəkildə ya src, ya da procedural olmalıdır",
  })
  .refine((a) => a.kind !== "placeholder" || !!a.promptId, { message: "placeholder üçün promptId lazımdır" });
export type BackgroundArt = z.infer<typeof BackgroundArt>;

/** How a mood shifts the colours inside a theme (Çaldıran darker, a coronation brighter). */
export const MoodTone = z.object({
  /** Colour the surface and backdrop drift toward. */
  tint: HexColor,
  /** 0..0.25: share of the tint mixed into the surface; kept small for legibility. */
  strength: z.number().min(0).max(0.25),
  /** Brightness of the backdrop art, 0.4..1.3. */
  brightness: z.number().min(0.4).max(1.3),
});
export type MoodTone = z.infer<typeof MoodTone>;

const Palette = z.object({
  /** Main colour: current step, headings accents, primary marks. */
  primary: HexColor,
  /** Ornaments, gold lines, highlights. */
  accent: HexColor,
  /** Paper / page background. */
  surface: HexColor,
  /** Body text. */
  text: HexColor,
  /** Links and interactive text; defaults to a lapis blue. */
  link: HexColor.optional(),
});

export const Theme = z.object({
  id: Slug,
  name: LocalizedText,
  palette: Palette,
  fonts: z.object({ display: FontKey, body: FontKey }),
  textures: z.object({ background: z.enum(TEXTURES), paper: z.enum(TEXTURES), frame: z.enum(TEXTURES) }),
  ornaments: z.object({
    border: z.enum(BORDER_ORNAMENTS),
    divider: z.enum(DIVIDER_ORNAMENTS),
    corner: z.enum(CORNER_ORNAMENTS),
  }),
  backgroundArt: z.array(BackgroundArt),
  ambientEffect: z.enum(AMBIENT_EFFECTS),
  mapStyleVariant: z.enum(MAP_STYLE_VARIANTS),
  /** Key in MUSIC_THEMES (src/features/audio/manifest.ts). */
  musicThemeId: Slug,
  moodTones: z.partialRecord(Mood, MoodTone).optional(),
});
export type Theme = z.infer<typeof Theme>;

/**
 * A variant of another theme (e.g. Əfşar → Hind yürüşü): only the parts that
 * differ, merged section by section over the parent.
 */
export const ThemeVariant = z.object({
  id: Slug,
  name: LocalizedText,
  extends: Slug,
  palette: Palette.partial().optional(),
  fonts: Theme.shape.fonts.partial().optional(),
  textures: Theme.shape.textures.partial().optional(),
  ornaments: Theme.shape.ornaments.partial().optional(),
  backgroundArt: z.array(BackgroundArt).optional(),
  ambientEffect: Theme.shape.ambientEffect.optional(),
  mapStyleVariant: Theme.shape.mapStyleVariant.optional(),
  musicThemeId: Slug.optional(),
  moodTones: Theme.shape.moodTones,
});
export type ThemeVariant = z.infer<typeof ThemeVariant>;

export const ThemeFile = z.union([ThemeVariant, Theme]);
export type ThemeFile = z.infer<typeof ThemeFile>;

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

/**
 * Directed relation: `from` is <type> of `to` (e.g. Uzun Həsən is grandparent of İsmayıl).
 * The moments where two stories cross live on the steps themselves, as `related` refs.
 */
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
  /**
   * Lower-case word stems that mark the term in running text. Azerbaijani is
   * agglutinative, so "qızılbaş" also matches "qızılbaşlar", "qızılbaşların".
   */
  forms: z.array(z.string().min(2)).min(1),
  sources: z.array(Source).optional(),
});
export const GlossaryFile = z.object({ entries: z.array(GlossaryEntry) });
export type GlossaryEntry = z.infer<typeof GlossaryEntry>;

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

export const PLACE_TYPES = ["capital", "city", "fortress", "shrine", "battlefield", "port"] as const;
export const PlaceType = z.enum(PLACE_TYPES);
export type PlaceType = z.infer<typeof PlaceType>;

export const PlacePeriod = z.object({
  from: z.number().int(),
  to: z.number().int(),
  /** Name used in this period, when it differs from `names.historical`. */
  name: LocalizedText.optional(),
});

/** A city or site drawn on the map independently of any person's events. */
export const Place = z.object({
  id: Slug,
  names: z.object({ historical: LocalizedText, modern: LocalizedText.optional() }),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Base type. Whether a place is a capital in a given year comes from the territory snapshot. */
  type: PlaceType,
  /** 1 = always visible, 2 = regional, 3 = only when zoomed in. */
  importance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Years in which the place is shown on the map. */
  periods: z.array(PlacePeriod).min(1),
  description: LocalizedText,
  sources: z.array(Source).optional(),
  /**
   * Announced chapters of the place's history that have no simulation yet
   * (Şuşa: the Karabakh khanate). Shown as "tezliklə" items on the place page.
   */
  upcoming: z
    .array(z.object({ year: z.number().int(), title: LocalizedText, ref: z.lazy(() => EntityRef).optional(), sources: z.array(Source).min(1) }))
    .optional(),
});
export type Place = z.infer<typeof Place>;
export const PlacesFile = z.object({ places: z.array(Place) });

// ---------------------------------------------------------------------------
// Territories
// ---------------------------------------------------------------------------

export const POLITY_STATUSES = ["rise", "peak", "stable", "war", "crisis", "decline"] as const;

/** What the ruler panel says about a polity for a span of years. */
export const PolityFacts = z.object({
  from: z.number().int(),
  to: z.number().int(),
  status: z.enum(POLITY_STATUSES),
  /** One or two sentences on the situation in these years. */
  statusNote: LocalizedText,
  religion: LocalizedText.optional(),
  /** Official, chancery and court languages. */
  languages: LocalizedText.optional(),
  /** Polity ids (data/polities). */
  rivals: z.array(Slug).optional(),
  allies: z.array(Slug).optional(),
  sources: z.array(Source).min(1),
});
export type PolityFacts = z.infer<typeof PolityFacts>;

/** A state or dynasty (data/polities/<id>.json); colours stay the same across snapshots. */
export const Polity = z.object({
  id: Slug,
  name: LocalizedText,
  color: HexColor,
  /** Historical flag or emblem, only with a clear source and licence. */
  emblem: ImageAsset.optional(),
  /** Years the polity existed (used to say "no data" vs "did not exist"). */
  periods: z.array(z.object({ from: z.number().int(), to: z.number().int() })).min(1),
  facts: z.array(PolityFacts).optional(),
  /** The state simulation for this polity, when one exists or is planned (data/planned.json). */
  stateId: Slug.optional(),
});
export type Polity = z.infer<typeof Polity>;

const YearMonth = z.object({ year: z.number().int(), month: z.number().int().min(1).max(12).optional() });

export const Ruler = z.object({
  id: Slug,
  name: LocalizedText,
  titles: z.array(LocalizedText).min(1),
  dynasty: LocalizedText.optional(),
  born: YearMonth.extend({ certainty: Certainty }).optional(),
  died: YearMonth.extend({ certainty: Certainty }).optional(),
  portraits: z.array(ImageAsset).optional(),
  /** Person simulation of this ruler, if any. */
  personId: Slug.optional(),
  related: z.array(EntityRef).optional(),
  sources: z.array(Source).min(1),
});
export type Ruler = z.infer<typeof Ruler>;
export const RulersFile = z.object({ rulers: z.array(Ruler) });

/** Who ruled which polity when. The ruler panel is computed from this table, never written per event. */
export const Reign = z.object({
  polityId: Slug,
  rulerId: Slug,
  start: YearMonth,
  end: YearMonth,
  certainty: Certainty,
  note: LocalizedText.optional(),
});
export type Reign = z.infer<typeof Reign>;
export const ReignsFile = z.object({ reigns: z.array(Reign) });

/** Building blocks for hand-made borders: each region is the Voronoi area around its seed points. */
export const TerritoryRegion = z.object({ id: Slug, seeds: z.array(LngLat).min(1) });
export const TerritoryRegistryFile = z.object({
  /** [west, south, east, north] of the area that is drawn. */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  /** Names for sets of regions, so older snapshots keep working when a region is split (e.g. for khanates). */
  groups: z.record(z.string(), z.array(Slug)).optional(),
  regions: z.array(TerritoryRegion),
});

/** Authoring format of data/territories/snapshots/<id>.json. */
export const TerritorySnapshotSource = z.object({
  id: Slug,
  year: z.number().int(),
  title: LocalizedText,
  certainty: Certainty,
  note: LocalizedText.optional(),
  polities: z
    .array(
      z.object({
        polityId: Slug,
        /** Overrides the registry name, e.g. "Ağqoyunlu (parçalanmış)". */
        name: LocalizedText.optional(),
        /** Hand-made borders: regions from the registry. */
        regions: z.array(Slug).min(1).optional(),
        /** Present-day borders: ISO 3166 alpha-3 code in data/territories/countries.json. */
        iso: z.string().regex(/^[A-Z]{3}$/).optional(),
        capitalId: Slug.optional(),
        vassalOf: Slug.optional(),
        /** Label position [lng, lat]; defaults to a point inside the largest part. */
        labelAt: LngLat.optional(),
      }),
    )
    .min(1)
    .refine((ps) => ps.every((p) => !!p.regions !== !!p.iso), { message: "hər dövlətdə ya regions, ya da iso olmalıdır" }),
  sources: z.array(Source).min(1),
});
export type TerritorySnapshotSource = z.infer<typeof TerritorySnapshotSource>;

const Geometry = z.object({
  type: z.enum(["Polygon", "MultiPolygon"]),
  coordinates: z.array(z.any()),
});

/** Built snapshot served to the browser (public/data/territories/<id>.json). */
export const TerritorySnapshot = z.object({
  id: Slug,
  year: z.number().int(),
  title: LocalizedText,
  certainty: Certainty,
  note: LocalizedText.optional(),
  polities: z.array(
    z.object({
      id: Slug,
      name: LocalizedText,
      color: HexColor,
      geometry: Geometry,
      capitalId: Slug.optional(),
      vassalOf: Slug.optional(),
      labelAt: LngLat,
      /** Area of the drawn (approximate) polygon. */
      areaKm2: z.number().optional(),
    }),
  ),
  sources: z.array(Source),
});
export type TerritorySnapshot = z.infer<typeof TerritorySnapshot>;

/** What the page needs to pick and prefetch snapshots, without the geometry. */
export interface TerritorySnapshotMeta {
  id: string;
  year: number;
  title: LocalizedText;
  certainty: Certainty;
  note?: LocalizedText;
  sources: Source[];
  polities: { id: string; name: LocalizedText; color: string; capitalId?: string; vassalOf?: string }[];
}

// ---------------------------------------------------------------------------
// World context
// ---------------------------------------------------------------------------

export const WORLD_REGIONS = ["europe", "middle-east", "asia", "africa", "americas"] as const;

/** "Meanwhile in the world" entry. */
export const WorldEvent = z.object({
  id: Slug,
  year: z.number().int(),
  endYear: z.number().int().optional(),
  region: z.enum(WORLD_REGIONS),
  title: LocalizedText,
  description: LocalizedText,
  sources: z.array(Source).min(1),
});
export type WorldEvent = z.infer<typeof WorldEvent>;
export const WorldEventsFile = z.object({ events: z.array(WorldEvent) });

// ---------------------------------------------------------------------------
// State simulations
// ---------------------------------------------------------------------------

/** Key figures of a stage; every value is a short text so ranges and caveats fit. Omit what no source gives. */
export const KeyFacts = z.object({
  area: LocalizedText.optional(),
  population: LocalizedText.optional(),
  army: LocalizedText.optional(),
  economy: LocalizedText.optional(),
  religion: LocalizedText.optional(),
  languages: LocalizedText.optional(),
});
export type KeyFacts = z.infer<typeof KeyFacts>;

/** One stage in the history of a state (data/states/<id>/steps.json). */
export const StateStep = z.object({
  id: Slug,
  order: z.number().int().min(0),
  date: HistoricalDate,
  title: LocalizedText,
  /** Verified facts only. */
  summary: LocalizedText,
  mood: Mood,
  /** Where the camera looks; zoom out to show the whole state. */
  location: Location,
  zoom: z.number().min(2.5).max(9).optional(),
  territorySnapshotId: Slug.optional(),
  /** Capital in this stage (data/places.json). */
  capitalId: Slug.optional(),
  /** Polity whose ruler and borders this stage is about; defaults to the state's polity. */
  polityId: Slug.optional(),
  /** Short dated items inside the stage. */
  events: z.array(z.object({ date: z.string().min(1), text: LocalizedText })).optional(),
  keyFacts: KeyFacts.optional(),
  related: z.array(EntityRef).optional(),
  /** Theme variant for this step only, e.g. the Indian campaign (data/themes). */
  themeId: Slug.optional(),
  /** What kind of statement the stage as a whole is (default "fact"). */
  claimType: ClaimType.optional(),
  /** Individual statements classified as fact, disputed, legend or literary. */
  claims: z.array(Claim).optional(),
  sources: z.array(Source).min(1),
  quiz: z.array(QuizQuestion).min(1).max(3).optional(),
});
export type StateStep = z.infer<typeof StateStep>;
export const StateStepsFile = z.object({ steps: z.array(StateStep).min(1) });

export const State = z.object({
  id: Slug,
  /** Polity in data/polities this simulation is about. */
  polityId: Slug,
  name: LocalizedText,
  /** e.g. "1736–1796" */
  years: z.string().min(1),
  description: LocalizedText,
  /** Shown on the final screen. */
  legacy: LocalizedText,
  image: ImageAsset.optional(),
  eraIds: z.array(Slug).min(1),
  /** Overrides the era's theme (data/themes). */
  themeId: Slug.optional(),
  /** Polities whose rulers form the dynasty strip under the timeline, in order. */
  dynasty: z.array(Slug).optional(),
  sources: z.array(Source).min(1),
});
export type State = z.infer<typeof State>;

// ---------------------------------------------------------------------------
// Conflicts (wars) and battles
// ---------------------------------------------------------------------------

/** A settlement that changed hands in a war (coordinates from OpenStreetMap, ODbL). */
export const Settlement = z.object({
  id: Slug,
  name: LocalizedText,
  district: LocalizedText,
  kind: z.enum(["city", "town", "village", "height", "district"]),
  /** Omitted when no reliable coordinate was found: the name is listed, no marker is drawn. */
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type Settlement = z.infer<typeof Settlement>;

export const OfficialStatement = z.object({ title: LocalizedText, url: z.url(), date: z.string().min(1) });

/** One day (or one memorial / epilogue stage) of a war. */
export const WarDay = z.object({
  id: Slug,
  order: z.number().int().min(0),
  date: HistoricalDate,
  /** "Müharibənin N-ci günü"; absent for the epilogue. */
  dayNumber: z.number().int().min(1).optional(),
  kind: z.enum(["operation", "liberation", "memorial", "statement", "epilogue"]),
  title: LocalizedText,
  /** Facts from official sources only. */
  summary: LocalizedText,
  mood: Mood,
  location: Location,
  zoom: z.number().min(2.5).max(10).optional(),
  territorySnapshotId: Slug.optional(),
  /** Settlement ids announced as liberated (or returned) on this day. */
  liberated: z.array(Slug).optional(),
  /** Liberated places announced only as a number, without names. */
  extraLiberated: z.object({ villages: z.number().int().min(0).optional(), towns: z.number().int().min(0).optional(), heights: z.number().int().min(0).optional() }).optional(),
  commanders: z.array(Slug).optional(),
  /** Heroes who fell on this day; only when an official source gives the date. */
  fallenHeroes: z.array(Slug).optional(),
  officialStatement: OfficialStatement.optional(),
  related: z.array(EntityRef).optional(),
  /** Theme variant for this step only, e.g. the Indian campaign (data/themes). */
  themeId: Slug.optional(),
  /** What kind of statement the stage as a whole is (default "fact"). */
  claimType: ClaimType.optional(),
  /** Individual statements classified as fact, disputed, legend or literary. */
  claims: z.array(Claim).optional(),
  sources: z.array(Source).min(1),
  quiz: z.array(QuizQuestion).min(1).max(3).optional(),
});
export type WarDay = z.infer<typeof WarDay>;
export const WarDaysFile = z.object({ days: z.array(WarDay).min(1) });

export const Conflict = z.object({
  id: Slug,
  name: LocalizedText,
  /** Section heading, e.g. "Şanlı Zəfər tariximiz". */
  heading: LocalizedText,
  years: z.string().min(1),
  description: LocalizedText,
  legacy: LocalizedText,
  /** Short notes on the final screen (memorial days etc.). */
  finalNotes: z.array(z.object({ title: LocalizedText, text: LocalizedText, sources: z.array(Source).min(1) })).optional(),
  /** Date revealed by the intro, e.g. "27 sentyabr 2020". */
  introDate: LocalizedText,
  eraIds: z.array(Slug).min(1),
  /** Overrides the era's theme (data/themes). */
  themeId: Slug.optional(),
  sources: z.array(Source).min(1),
});
export type Conflict = z.infer<typeof Conflict>;

export const Commander = z.object({
  id: Slug,
  name: LocalizedText,
  /** Position in the year of the conflict. */
  position: LocalizedText,
  role: LocalizedText,
  /** Days (step ids) the commander is named in. */
  days: z.array(Slug),
  sources: z.array(Source).min(1),
});
export type Commander = z.infer<typeof Commander>;
export const CommandersFile = z.object({ commanders: z.array(Commander) });

/** Photos only from official sources with clear permission; never generated for real people. */
export const HeroPhoto = z.object({ url: z.string().min(1), source: z.string().min(1), license: z.string().min(1), permissionNote: z.string().min(1) });

export const Hero = z.object({
  id: Slug,
  name: LocalizedText,
  rank: LocalizedText,
  posthumous: z.boolean(),
  birthPlace: LocalizedText.optional(),
  awards: z.array(LocalizedText).min(1),
  description: LocalizedText.optional(),
  photo: HeroPhoto.optional(),
  sources: z.array(Source).min(1),
});
export type Hero = z.infer<typeof Hero>;
export const HeroesFile = z.object({ heroes: z.array(Hero) });

/** Music for a conflict. Copyrighted tracks stay "pending" until the rights holder agrees; only "granted" ones are built. */
export const Track = z.object({
  trackId: Slug,
  title: LocalizedText,
  performer: z.string().min(1),
  mood: Mood,
  license: z.string().min(1),
  rightsHolder: z.string().min(1),
  permissionStatus: z.enum(["pending", "granted"]),
  /** Path under public/ without extension, only for granted tracks. */
  file: z.string().optional(),
});
export type Track = z.infer<typeof Track>;
export const SoundtrackFile = z.object({ tracks: z.array(Track) });

export const Battle = z.object({
  id: Slug,
  conflictId: Slug,
  name: LocalizedText,
  /** Day of the conflict simulation that shows this battle. */
  stepId: Slug,
  dates: z.string().min(1),
  summary: LocalizedText,
  sources: z.array(Source).min(1),
});
export type Battle = z.infer<typeof Battle>;
