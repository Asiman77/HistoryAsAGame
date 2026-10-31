/**
 * Validates everything under data/ against the Zod schema and the
 * cross-record integrity rules. Exits non-zero on any problem.
 *   npm run validate:data
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Era, EventsFile, GlossaryFile, Person, RelationsFile } from "../src/domain/schema";
import { checkEra, checkPerson, checkRelations, type Issue } from "../src/domain/integrity";

const root = path.join(process.cwd(), "data");
const issues: Issue[] = [];
const rel = (f: string) => path.relative(process.cwd(), f).replaceAll("\\", "/");

function load<T>(file: string, schema: z.ZodType<T>): T | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    issues.push({ file: rel(file), message: `JSON oxunmadı: ${(e as Error).message}` });
    return undefined;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    for (const i of result.error.issues)
      issues.push({ file: rel(file), message: `${i.path.join(".") || "(root)"}: ${i.message}` });
    return undefined;
  }
  return result.data;
}

const eras: Era[] = [];
for (const f of fs.readdirSync(path.join(root, "eras")).filter((f) => f.endsWith(".json"))) {
  const file = path.join(root, "eras", f);
  const era = load(file, Era);
  if (!era) continue;
  if (`${era.id}.json` !== f) issues.push({ file: rel(file), message: `fayl adı id ilə uyğun deyil (${era.id})` });
  issues.push(...checkEra(era, rel(file)));
  eras.push(era);
}

const personIds = new Set<string>();
let eventCount = 0;
const personsDir = path.join(root, "persons");
for (const dir of fs.readdirSync(personsDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const personFile = path.join(personsDir, dir.name, "person.json");
  const eventsFile = path.join(personsDir, dir.name, "events.json");
  const person = load(personFile, Person);
  const events = fs.existsSync(eventsFile) ? load(eventsFile, EventsFile)?.events : undefined;
  if (!fs.existsSync(eventsFile)) issues.push({ file: rel(eventsFile), message: "fayl yoxdur" });
  if (!person) continue;
  if (person.id !== dir.name) issues.push({ file: rel(personFile), message: `qovluq adı id ilə uyğun deyil (${person.id})` });
  personIds.add(person.id);
  if (events) {
    eventCount += events.length;
    issues.push(...checkPerson(person, events, eras, rel(eventsFile)));
    if (events.length < 10)
      console.warn(`⚠  ${person.id}: yalnız ${events.length} hadisə (hədəf 10–15)`);
  }
}

const relationsFile = path.join(root, "relations.json");
if (fs.existsSync(relationsFile)) {
  const data = load(relationsFile, RelationsFile);
  if (data) issues.push(...checkRelations(data.relations, personIds, rel(relationsFile)));
}
const glossaryFile = path.join(root, "glossary.json");
if (fs.existsSync(glossaryFile)) load(glossaryFile, GlossaryFile);

if (issues.length) {
  console.error(`✗ ${issues.length} problem tapıldı:\n`);
  for (const i of issues) console.error(`  ${i.file}\n    ${i.message}`);
  process.exit(1);
}
console.log(`✓ Data etibarlıdır: ${eras.length} dövr, ${personIds.size} şəxsiyyət, ${eventCount} hadisə.`);
