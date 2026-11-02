/**
 * Validates everything under data/ against the Zod schema and the
 * cross-record integrity rules. Exits non-zero on any problem.
 *   npm run validate:data
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  Era,
  EventsFile,
  GlossaryFile,
  Person,
  PlacesFile,
  Polity,
  ReignsFile,
  RulersFile,
  State,
  StateStepsFile,
  type StateStep,
  Battle,
  CommandersFile,
  Conflict,
  HeroesFile,
  Settlement,
  SoundtrackFile,
  WarDaysFile,
  type WarDay,
  PlannedFile,
  RelationsFile,
  TerritoryRegistryFile,
  TerritorySnapshotSource,
  WorldEventsFile,
  ThemeFile,
  MOODS,
  type LifeEvent,
  type Person as PersonT,
} from "../src/domain/schema";
import { buildRegistry, checkRef, type RefIssue } from "../src/domain/registry";
import { compareDates } from "../src/lib/dates";
import { resolveThemes, themeContrastIssues, type ThemeMap } from "../src/lib/theme";
import { MUSIC_THEMES } from "../src/features/audio/manifest";
import {
  checkEra,
  checkEventReferences,
  checkPerson,
  checkRelations,
  type Issue,
} from "../src/domain/integrity";

const root = path.join(process.cwd(), "data");
const issues: Issue[] = [];
const rel = (f: string) => path.relative(process.cwd(), f).replaceAll("\\", "/");
const add = (file: string, message: string) => issues.push({ file: rel(file), message });

function load<T>(file: string, schema: z.ZodType<T>): T | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    add(file, `JSON oxunmadı: ${(e as Error).message}`);
    return undefined;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    for (const i of result.error.issues) add(file, `${i.path.join(".") || "(root)"}: ${i.message}`);
    return undefined;
  }
  return result.data;
}

const unique = (file: string, what: string, ids: string[]) => {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) add(file, `təkrarlanan ${what}: ${id}`);
    seen.add(id);
  }
  return seen;
};

// --- eras ---
const eras: Era[] = [];
for (const f of fs.readdirSync(path.join(root, "eras")).filter((f) => f.endsWith(".json"))) {
  const file = path.join(root, "eras", f);
  const era = load(file, Era);
  if (!era) continue;
  if (`${era.id}.json` !== f) add(file, `fayl adı id ilə uyğun deyil (${era.id})`);
  issues.push(...checkEra(era, rel(file)));
  eras.push(era);
}

// --- places ---
const placesFile = path.join(root, "places.json");
const places = load(placesFile, PlacesFile)?.places ?? [];
const placeIds = unique(placesFile, "place id", places.map((p) => p.id));
for (const p of places) for (const r of p.periods) if (r.from > r.to) add(placesFile, `${p.id}: period from > to`);

// --- territories ---
const regFile = path.join(root, "territories", "registry.json");
const registry = load(regFile, TerritoryRegistryFile);
// --- polities, rulers, reigns ---
const polityDir = path.join(root, "polities");
const polities = fs
  .readdirSync(polityDir)
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => {
    const file = path.join(polityDir, f);
    const p = load(file, Polity);
    if (p && `${p.id}.json` !== f) add(file, `fayl adı id ilə uyğun deyil (${p.id})`);
    return p ? [{ p, file }] : [];
  });
const polityIds = new Set(polities.map(({ p }) => p.id));
for (const { p, file } of polities)
  for (const fct of p.facts ?? []) {
    if (fct.from > fct.to) add(file, `facts ${fct.from}–${fct.to}: from > to`);
    for (const id of [...(fct.rivals ?? []), ...(fct.allies ?? [])]) if (!polityIds.has(id)) add(file, `naməlum polity: ${id}`);
  }
const rulersFile = path.join(root, "rulers.json");
const rulers = fs.existsSync(rulersFile) ? (load(rulersFile, RulersFile)?.rulers ?? []) : [];
const rulerIds = unique(rulersFile, "ruler id", rulers.map((r) => r.id));
const reignsFile = path.join(root, "reigns.json");
const reigns = fs.existsSync(reignsFile) ? (load(reignsFile, ReignsFile)?.reigns ?? []) : [];
for (const r of reigns) {
  const where = `${r.polityId}/${r.rulerId}`;
  if (!polityIds.has(r.polityId)) add(reignsFile, `${where}: naməlum polity`);
  if (!rulerIds.has(r.rulerId)) add(reignsFile, `${where}: naməlum hökmdar`);
  if (r.start.year > r.end.year) add(reignsFile, `${where}: start > end`);
  const pol = polities.find(({ p }) => p.id === r.polityId)?.p;
  if (pol && !pol.periods.some((pd) => r.start.year >= pd.from - 1 && r.end.year <= pd.to + 1))
    add(reignsFile, `${where}: hakimiyyət dövlətin mövcud olduğu illərdən kənardadır`);
}
const regionIds = unique(regFile, "region id", registry?.regions.map((r) => r.id) ?? []);
const groups = registry?.groups ?? {};
for (const [g, parts] of Object.entries(groups)) {
  if (regionIds.has(g)) add(regFile, `qrup adı region adı ilə eynidir: ${g}`);
  for (const p of parts) if (!regionIds.has(p)) add(regFile, `${g} qrupunda naməlum region: ${p}`);
}
const expand = (r: string) => groups[r] ?? [r];
for (const g of Object.keys(groups)) regionIds.add(g);
if (!fs.existsSync(path.join(root, "territories", "land.json"))) add(regFile, "land.json yoxdur (scripts/prepare-land.ts)");
const countriesFile = path.join(root, "territories", "countries.json");
const countryCodes = new Set<string>(
  fs.existsSync(countriesFile) ? Object.keys(JSON.parse(fs.readFileSync(countriesFile, "utf8")).countries) : [],
);
const snapshotIds = new Set<string>();
const snapshotYears = new Set<number>();
const snapDir = path.join(root, "territories", "snapshots");
for (const f of fs.existsSync(snapDir) ? fs.readdirSync(snapDir).filter((f) => f.endsWith(".json")) : []) {
  const file = path.join(snapDir, f);
  const s = load(file, TerritorySnapshotSource);
  if (!s) continue;
  if (`${s.id}.json` !== f) add(file, `fayl adı id ilə uyğun deyil (${s.id})`);
  if (snapshotYears.has(s.year)) add(file, `eyni il üçün ikinci snapshot: ${s.year}`);
  snapshotIds.add(s.id);
  snapshotYears.add(s.year);
  const used = new Map<string, string>();
  for (const p of s.polities) {
    if (!polityIds.has(p.polityId)) add(file, `naməlum polity: ${p.polityId}`);
    if (p.capitalId && !placeIds.has(p.capitalId)) add(file, `${p.polityId}: naməlum paytaxt ${p.capitalId}`);
    if (p.vassalOf && !s.polities.some((q) => q.polityId === p.vassalOf) && !polityIds.has(p.vassalOf))
      add(file, `${p.polityId}: naməlum vassalOf ${p.vassalOf}`);
    if (p.iso && !countryCodes.has(p.iso)) add(file, `${p.polityId}: naməlum ölkə kodu ${p.iso}`);
    for (const r of p.regions ?? []) {
      if (!regionIds.has(r)) add(file, `${p.polityId}: naməlum region ${r}`);
      for (const part of expand(r)) {
        if (used.has(part)) add(file, `region ${part} iki dövlətdədir: ${used.get(part)} və ${p.polityId}`);
        used.set(part, p.polityId);
      }
    }
  }
}

// Theme references collected while loading; checked in the themes section.
const themeRefs: { file: string; where: string; id: string }[] = [];
const refTheme = (file: string, where: string, id: string | undefined) => id && themeRefs.push({ file: rel(file), where, id });
for (const e of eras) refTheme(path.join(root, "eras", `${e.id}.json`), e.id, e.themeId);

// --- persons ---
const personIds = new Set<string>();
const loaded: { person: PersonT; events: LifeEvent[]; file: string }[] = [];
const eventIdsByPerson = new Map<string, Set<string>>();
let eventCount = 0;
const personsDir = path.join(root, "persons");
const promptsFile = path.join(root, "..", "docs", "portrait-prompts.md");
const promptIds = new Set(
  fs.existsSync(promptsFile) ? [...fs.readFileSync(promptsFile, "utf8").matchAll(/<a id="([a-z0-9-]+)"><\/a>/g)].map((x) => x[1]!) : [],
);
for (const dir of fs.readdirSync(personsDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const personFile = path.join(personsDir, dir.name, "person.json");
  const eventsFile = path.join(personsDir, dir.name, "events.json");
  const person = load(personFile, Person);
  const events: LifeEvent[] | undefined = fs.existsSync(eventsFile) ? load(eventsFile, EventsFile)?.events : undefined;
  if (!fs.existsSync(eventsFile)) add(eventsFile, "fayl yoxdur");
  if (!person) continue;
  if (person.id !== dir.name) add(personFile, `qovluq adı id ilə uyğun deyil (${person.id})`);
  personIds.add(person.id);
  refTheme(personFile, person.id, person.themeId);
  for (const e of events ?? []) refTheme(eventsFile, e.id, e.themeId);
  for (const p of person.portraits ?? []) {
    const where = `portraits ${p.ageFrom}–${p.ageTo}`;
    if (p.src?.startsWith("/") && !fs.existsSync(path.join(root, "..", "public", p.src))) add(personFile, `${where}: ${p.src} tapılmadı`);
    if (p.promptId && !promptIds.has(p.promptId)) add(personFile, `${where}: docs/portrait-prompts.md-də '${p.promptId}' yoxdur`);
  }
  if (events) {
    eventCount += events.length;
    eventIdsByPerson.set(person.id, new Set(events.map((e) => e.id)));
    loaded.push({ person, events, file: rel(eventsFile) });
    issues.push(...checkPerson(person, events, eras, rel(eventsFile)));
    issues.push(...checkEventReferences(events, { placeIds, polityIds, snapshotIds }, rel(eventsFile)));
    if (events.length < 10) console.warn(`⚠  ${person.id}: yalnız ${events.length} hadisə (hədəf 10–15)`);
  }
}

// --- relations, glossary, world ---
const relationsFile = path.join(root, "relations.json");
if (fs.existsSync(relationsFile)) {
  const data = load(relationsFile, RelationsFile);
  if (data) {
    issues.push(...checkRelations(data.relations, personIds, rel(relationsFile)));
  }
}
const glossaryFile = path.join(root, "glossary.json");
const glossary = fs.existsSync(glossaryFile) ? (load(glossaryFile, GlossaryFile)?.entries ?? []) : [];
unique(glossaryFile, "glossary id", glossary.map((g) => g.id));
for (const g of glossary) for (const f of g.forms) if (f !== f.toLowerCase()) add(glossaryFile, `${g.id}: forms kiçik hərflə olmalıdır`);

const worldFile = path.join(root, "world-events.json");
const world = fs.existsSync(worldFile) ? (load(worldFile, WorldEventsFile)?.events ?? []) : [];
unique(worldFile, "world event id", world.map((w) => w.id));
for (const w of world) if (w.endYear !== undefined && w.endYear < w.year) add(worldFile, `${w.id}: endYear < year`);

for (const r of rulers)
  if (r.personId && !personIds.has(r.personId)) add(rulersFile, `${r.id}: naməlum personId ${r.personId}`);

// --- state simulations ---
const statesDir = path.join(root, "states");
const loadedStates: { id: string; steps: StateStep[]; file: string }[] = [];
for (const d of fs.existsSync(statesDir) ? fs.readdirSync(statesDir, { withFileTypes: true }).filter((x) => x.isDirectory()) : []) {
  const sFile = path.join(statesDir, d.name, "state.json");
  const stFile = path.join(statesDir, d.name, "steps.json");
  const st = load(sFile, State);
  const steps = fs.existsSync(stFile) ? load(stFile, StateStepsFile)?.steps : undefined;
  if (!st || !steps) continue;
  if (st.id !== d.name) add(sFile, `qovluq adı id ilə uyğun deyil (${st.id})`);
  if (!polityIds.has(st.polityId)) add(sFile, `naməlum polity: ${st.polityId}`);
  for (const e of st.eraIds) if (!eras.some((x) => x.id === e)) add(sFile, `naməlum era: ${e}`);
  unique(stFile, "step id", steps.map((x) => x.id));
  unique(stFile, "order", steps.map((x) => String(x.order)));
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  for (let i = 1; i < sorted.length; i++)
    if (sorted[i]!.date.year < sorted[i - 1]!.date.year) add(stFile, `xronologiya pozulub: ${sorted[i - 1]!.id} → ${sorted[i]!.id}`);
  for (const x of steps) {
    if (x.territorySnapshotId && !snapshotIds.has(x.territorySnapshotId)) add(stFile, `${x.id}: naməlum snapshot ${x.territorySnapshotId}`);
    if (x.capitalId && !placeIds.has(x.capitalId)) add(stFile, `${x.id}: naməlum paytaxt ${x.capitalId}`);
    if (x.polityId && !polityIds.has(x.polityId)) add(stFile, `${x.id}: naməlum polity ${x.polityId}`);
    if (x.date.certainty === "disputed" && !x.date.alternatives?.length) add(stFile, `${x.id}: 'disputed' tarix üçün alternatives tələb olunur`);
  }
  refTheme(sFile, st.id, st.themeId);
  for (const x of steps) refTheme(stFile, x.id, x.themeId);
  loadedStates.push({ id: st.id, steps, file: rel(stFile) });
}

// --- conflicts ---
const conflictsDir = path.join(root, "conflicts");
const loadedConflicts: { id: string; days: WarDay[]; file: string }[] = [];
const battles: { id: string; url: string }[] = [];
for (const d of fs.existsSync(conflictsDir) ? fs.readdirSync(conflictsDir, { withFileTypes: true }).filter((x) => x.isDirectory()) : []) {
  const base = path.join(conflictsDir, d.name);
  const c = load(path.join(base, "conflict.json"), Conflict);
  const dFile = path.join(base, "days.json");
  const days = load(dFile, WarDaysFile)?.days;
  if (!c || !days) continue;
  if (c.id !== d.name) add(path.join(base, "conflict.json"), `qovluq adı id ilə uyğun deyil (${c.id})`);
  const sFile = path.join(base, "settlements.json");
  const settlementIds = new Set(
    fs.existsSync(sFile) ? (load(sFile, z.object({ settlements: Settlement.array() }).passthrough())?.settlements ?? []).map((x) => x.id) : [],
  );
  const heroIds = new Set(fs.existsSync(path.join(base, "heroes.json")) ? (load(path.join(base, "heroes.json"), HeroesFile)?.heroes ?? []).map((h) => h.id) : []);
  const cFile = path.join(base, "commanders.json");
  const commanders = fs.existsSync(cFile) ? (load(cFile, CommandersFile)?.commanders ?? []) : [];
  const commanderIds = new Set(commanders.map((x) => x.id));
  unique(dFile, "day id", days.map((x) => x.id));
  for (const x of days) {
    for (const id of x.liberated ?? []) if (!settlementIds.has(id)) add(dFile, `${x.id}: naməlum yaşayış məntəqəsi ${id}`);
    for (const id of x.commanders ?? []) if (!commanderIds.has(id)) add(dFile, `${x.id}: naməlum komandan ${id}`);
    for (const id of x.fallenHeroes ?? []) if (!heroIds.has(id)) add(dFile, `${x.id}: naməlum qəhrəman ${id}`);
    if (x.territorySnapshotId && !snapshotIds.has(x.territorySnapshotId)) add(dFile, `${x.id}: naməlum snapshot ${x.territorySnapshotId}`);
  }
  const sorted = [...days].sort((a, b) => a.order - b.order);
  for (let i = 1; i < sorted.length; i++)
    if (compareDates(sorted[i]!.date, sorted[i - 1]!.date) < 0) add(dFile, `xronologiya pozulub: ${sorted[i - 1]!.id} → ${sorted[i]!.id}`);
  for (const cm of commanders) for (const day of cm.days) if (!days.some((x) => x.id === day)) add(cFile, `${cm.id}: naməlum gün ${day}`);
  const tFile = path.join(base, "soundtrack.json");
  for (const t of fs.existsSync(tFile) ? (load(tFile, SoundtrackFile)?.tracks ?? []) : []) {
    if (t.permissionStatus === "granted" && !t.file) add(tFile, `${t.trackId}: icazə var, amma fayl göstərilməyib`);
    if (t.permissionStatus === "pending" && t.file) add(tFile, `${t.trackId}: icazə gözlənilir, fayl əlavə edilməməlidir`);
  }
  const bDir = path.join(base, "battles");
  for (const bf of fs.existsSync(bDir) ? fs.readdirSync(bDir).filter((x) => x.endsWith(".json")) : []) {
    const b = load(path.join(bDir, bf), Battle);
    if (!b) continue;
    if (!days.some((x) => x.id === b.stepId)) add(path.join(bDir, bf), `naməlum stepId ${b.stepId}`);
    battles.push({ id: b.id, url: `/conflicts/${c.id}/?step=${b.stepId}` });
  }
  refTheme(path.join(base, "conflict.json"), c.id, c.themeId);
  for (const x of days) refTheme(dFile, x.id, x.themeId);
  loadedConflicts.push({ id: c.id, days, file: rel(dFile) });
}

// --- themes: references, inheritance, legibility, art files and credits ---
const themesDir = path.join(root, "themes");
const themeFiles = fs.existsSync(themesDir) ? fs.readdirSync(themesDir).filter((f) => f.endsWith(".json")) : [];
const rawThemes = themeFiles.flatMap((f) => {
  const t = load(path.join(themesDir, f), ThemeFile);
  if (t && t.id !== f.replace(/.json$/, "")) add(path.join(themesDir, f), `fayl adı id ilə uyğun deyil (${t.id})`);
  return t ? [t] : [];
});
let themes: ThemeMap = {};
try {
  themes = resolveThemes(rawThemes);
} catch (e) {
  add(themesDir, (e as Error).message);
}
if (!themes.default) add(themesDir, "default.json teması tələb olunur");
for (const r of themeRefs) if (!themes[r.id]) issues.push({ file: r.file, message: `${r.where}: naməlum tema ${r.id}` });
const imageCredits = fs.existsSync(path.join(root, "..", "docs", "IMAGE_CREDITS.md")) ? fs.readFileSync(path.join(root, "..", "docs", "IMAGE_CREDITS.md"), "utf8") : "";
const bgPromptsFile = path.join(root, "..", "docs", "background-prompts.md");
const bgPromptIds = new Set(
  fs.existsSync(bgPromptsFile) ? [...fs.readFileSync(bgPromptsFile, "utf8").matchAll(/<a id="([a-z0-9-]+)"><\/a>/g)].map((x) => x[1]!) : [],
);
for (const t of Object.values(themes)) {
  const file = path.join(themesDir, `${t.id}.json`);
  for (const msg of themeContrastIssues(t, MOODS)) add(file, msg);
  if (!(t.musicThemeId in MUSIC_THEMES)) add(file, `naməlum musicThemeId ${t.musicThemeId}`);
  for (const a of t.backgroundArt) {
    if (a.src) {
      for (const suffix of [".avif", ".webp", "-sm.avif", "-sm.webp"])
        if (!fs.existsSync(path.join(root, "..", "public", `${a.src}${suffix}`))) add(file, `fon şəkli tapılmadı: public${a.src}${suffix}`);
      if (!imageCredits.includes(`public${a.src}`)) add(file, `${a.src}: docs/IMAGE_CREDITS.md-də qeyd yoxdur`);
    }
    if (a.promptId && !bgPromptIds.has(a.promptId)) add(file, `docs/background-prompts.md-də '${a.promptId}' yoxdur`);
  }
}

// --- fact and legend: a step marked legend/disputed must say why; claim ids are unique ---
const claimIds = new Map<string, string>();
const claimCounts: Record<string, number> = { fact: 0, disputed: 0, legend: 0, literary: 0 };
const checkClaims = (file: string, steps: { id: string; claimType?: string | undefined; claims?: { id: string; claimType: string }[] | undefined }[]) => {
  for (const s of steps) {
    for (const c of s.claims ?? []) {
      claimCounts[c.claimType] = (claimCounts[c.claimType] ?? 0) + 1;
      const seen = claimIds.get(c.id);
      if (seen) issues.push({ file, message: `${s.id}: iddia id-si təkrarlanır: ${c.id} (${seen})` });
      claimIds.set(c.id, `${file}#${s.id}`);
    }
    if ((s.claimType === "legend" || s.claimType === "disputed") && !s.claims?.some((c) => c.claimType === s.claimType))
      issues.push({ file, message: `${s.id}: '${s.claimType}' kimi işarələnib, amma eyni növdən izahlı iddia (claims) yoxdur` });
    if (s.claimType === "literary") issues.push({ file, message: `${s.id}: mərhələ bütövlükdə 'literary' ola bilməz (bədii mətn narrative-dədir)` });
  }
};
for (const { events, file } of loaded) checkClaims(file, events);
for (const { steps, file } of loadedStates) checkClaims(file, steps);
for (const { days, file } of loadedConflicts) checkClaims(file, days);

// --- cross-links: every ref resolved through the same registry the pages use ---
const plannedFile = path.join(root, "planned.json");
const planned = fs.existsSync(plannedFile) ? (load(plannedFile, PlannedFile)?.entities ?? []) : [];
const entities = buildRegistry({
  simulations: loaded.map(({ person, events }) => ({
    type: "person" as const,
    id: person.id,
    title: person.name,
    steps: events.map((e) => ({ id: e.id, title: e.title, year: e.date.year })),
  })),
  others: places.map((p) => ({ type: "place" as const, id: p.id, title: p.names.historical })),
  planned,
});
for (const c of loadedConflicts)
  entities[`conflict:${c.id}`] = {
    type: "conflict",
    id: c.id,
    title: { az: c.id },
    url: `/conflicts/${c.id}/`,
    steps: Object.fromEntries(c.days.map((x) => [x.id, { title: x.title, year: x.date.year }])),
  };
for (const b of battles) entities[`battle:${b.id}`] = { type: "battle", id: b.id, title: { az: b.id }, url: b.url, steps: {} };
for (const st of loadedStates)
  entities[`state:${st.id}`] = {
    type: "state",
    id: st.id,
    title: { az: st.id },
    url: `/states/${st.id}/`,
    steps: Object.fromEntries(st.steps.map((x) => [x.id, { title: x.title, year: x.date.year }])),
  };
/** Missing or planned targets: grouped per target, since many events may point at the same one. */
const pending = new Map<string, string[]>();
let refCount = 0;
for (const { person, events, file } of loaded)
  for (const e of events)
    for (const r of e.related ?? []) {
      refCount++;
      if (r.type === "person" && r.id === person.id) issues.push({ file, message: `${e.id}: şəxsiyyət özünə istinad edir` });
      for (const i of checkRef(r, entities, e.id) as RefIssue[]) {
        if (i.level === "error") issues.push({ file, message: i.message });
        else {
          const key = `${r.type}:${r.id}`;
          pending.set(key, [...(pending.get(key) ?? []), e.id]);
        }
      }
    }
for (const { days, file } of loadedConflicts)
  for (const x of days)
    for (const r of x.related ?? []) {
      refCount++;
      for (const i of checkRef(r, entities, x.id) as RefIssue[]) {
        if (i.level === "error") issues.push({ file, message: i.message });
        else pending.set(`${r.type}:${r.id}`, [...(pending.get(`${r.type}:${r.id}`) ?? []), x.id]);
      }
    }
for (const { steps, file } of loadedStates)
  for (const x of steps)
    for (const r of x.related ?? []) {
      refCount++;
      for (const i of checkRef(r, entities, x.id) as RefIssue[]) {
        if (i.level === "error") issues.push({ file, message: i.message });
        else pending.set(`${r.type}:${r.id}`, [...(pending.get(`${r.type}:${r.id}`) ?? []), x.id]);
      }
    }
for (const pl of places)
  for (const u of pl.upcoming ?? [])
    if (u.ref) {
      refCount++;
      for (const i of checkRef(u.ref, entities, `${pl.id}.upcoming ${u.year}`) as RefIssue[]) {
        if (i.level === "error") issues.push({ file: "data/places.json", message: i.message });
        else pending.set(`${u.ref.type}:${u.ref.id}`, [...(pending.get(`${u.ref.type}:${u.ref.id}`) ?? []), `${pl.id}.upcoming`]);
      }
    }
for (const p of planned)
  if (loaded.some(({ person }) => p.type === "person" && p.id === person.id))
    console.warn(`⚠  data/planned.json: ${p.type}:${p.id} artıq mövcuddur, planned-dən silin`);
if (pending.size) {
  console.warn(`⚠  ${pending.size} obyekt hələ mövcud deyil, onlara keçidlər passiv ("tezliklə") göstəriləcək:`);
  for (const [k, from] of [...pending].sort()) console.warn(`   ${k}  ←  ${from.join(", ")}`);
}

if (issues.length) {
  console.error(`✗ ${issues.length} problem tapıldı:\n`);
  for (const i of issues) console.error(`  ${i.file}\n    ${i.message}`);
  process.exit(1);
}
console.log(
  `✓ Data etibarlıdır: ${eras.length} dövr, ${personIds.size} şəxsiyyət, ${eventCount} hadisə, ` +
    `${loadedStates.length} dövlət simulyasiyası, ${loadedConflicts.length} müharibə, ${places.length} məkan, ${polities.length} dövlət, ${rulers.length} hökmdar, ${snapshotIds.size} xəritə snapshot-u, ${world.length} dünya hadisəsi, ${glossary.length} termin, ${refCount} çarpaz keçid, ${Object.keys(themes).length} tema, iddialar: ${claimCounts.fact} fakt, ${claimCounts.disputed} mübahisəli, ${claimCounts.legend} rəvayət.`,
);
