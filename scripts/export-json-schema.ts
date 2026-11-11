/**
 * Generates shared/schema/ (JSON Schema, draft 2020-12) from the Zod model.
 *   npm run schema:export   write the files
 *   npm run schema:check    fail if the committed files differ from the Zod model
 *
 * Until the frontend switches to generated Zod (docs/adr/0005), the Zod model in
 * src/domain is authoritative and shared/schema must be regenerated after every change.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATA_FILES, SHARED_SCHEMAS } from "../src/domain/dataFiles";
import { MUSIC_THEMES } from "../src/features/audio/manifest";

/** Identifier only: validators map this prefix to the local files, nothing is fetched. */
export const SCHEMA_BASE = "https://tarixin-icinde.az/schema/v1/";
/** Bumped when a change makes existing documents invalid; stored with every editorial revision. */
export const SCHEMA_VERSION = 1;

const outDir = path.join(process.cwd(), "shared", "schema");

export function buildSchemaFiles(): Map<string, string> {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries(SHARED_SCHEMAS)) registry.add(schema, { id });
  for (const f of DATA_FILES) if (!registry.has(f.zod)) registry.add(f.zod, { id: f.schema });

  const { schemas } = z.toJSONSchema(registry, {
    target: "draft-2020-12",
    io: "input",
    unrepresentable: "throw",
    uri: (id) => `${SCHEMA_BASE}${id}.schema.json`,
    // z.url() accepts IRIs (non-ASCII, e.g. ".../wiki/Recep_Tayyip_Erdoğan"); strict "uri" (RFC 3986) would not.
    override: (ctx) => {
      if (ctx.jsonSchema.format === "uri") ctx.jsonSchema.format = "iri";
    },
  });

  const files = new Map<string, string>();
  const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

  for (const id of Object.keys(schemas).sort()) {
    const { $schema, ...rest } = schemas[id] as Record<string, unknown>;
    files.set(
      `${id}.schema.json`,
      json({ $schema, $id: `${SCHEMA_BASE}${id}.schema.json`, "x-schema-version": SCHEMA_VERSION, ...rest }),
    );
  }

  files.set(
    "files.json",
    json({
      $comment: "Which schema every file under data/ follows. Generated from src/domain/dataFiles.ts.",
      schemaVersion: SCHEMA_VERSION,
      base: SCHEMA_BASE,
      files: DATA_FILES.map((f) => ({ pattern: f.pattern, schema: f.schema })),
    }),
  );

  files.set(
    "music-themes.json",
    json({
      $comment: "Valid Theme.musicThemeId values. Generated from src/features/audio/manifest.ts.",
      musicThemes: Object.keys(MUSIC_THEMES).sort(),
    }),
  );
  return files;
}

function main() {
  const check = process.argv.includes("--check");
  const files = buildSchemaFiles();
  const existing = fs.existsSync(outDir)
    ? fs.readdirSync(outDir).filter((f) => f.endsWith(".json"))
    : [];

  if (check) {
    const problems: string[] = [];
    for (const [name, content] of files) {
      const file = path.join(outDir, name);
      if (!fs.existsSync(file)) problems.push(`missing: ${name}`);
      else if (fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n") !== content) problems.push(`out of date: ${name}`);
    }
    for (const name of existing) if (!files.has(name)) problems.push(`stale: ${name}`);
    if (problems.length) {
      console.error(`shared/schema differs from the Zod model. Run: npm run schema:export\n  ${problems.join("\n  ")}`);
      process.exit(1);
    }
    console.log(`shared/schema is up to date (${files.size} files).`);
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  for (const name of existing) if (!files.has(name)) fs.rmSync(path.join(outDir, name));
  for (const [name, content] of files) fs.writeFileSync(path.join(outDir, name), content);
  console.log(`Wrote ${files.size} files to shared/schema/.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename ?? "")) main();
