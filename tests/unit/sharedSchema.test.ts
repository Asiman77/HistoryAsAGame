import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DATA_FILES, NON_CONTENT_FILES, matchesPattern } from "@/domain/dataFiles";
import { buildSchemaFiles } from "../../scripts/export-json-schema";

const dataDir = path.join(process.cwd(), "data");
const schemaDir = path.join(process.cwd(), "shared", "schema");

function walk(dir: string, prefix = ""): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
  );
}

describe("shared/schema", () => {
  it("is generated from the current Zod model (run `npm run schema:export` after changing it)", () => {
    const generated = buildSchemaFiles();
    const committed = fs.readdirSync(schemaDir).filter((f) => f.endsWith(".json")).sort();
    expect(committed).toEqual([...generated.keys()].sort());
    for (const [name, content] of generated) {
      expect(fs.readFileSync(path.join(schemaDir, name), "utf8").replaceAll("\r\n", "\n"), name).toBe(content);
    }
  });

  it("covers every file under data/ with exactly one schema", () => {
    const files = walk(dataDir).filter((f) => !NON_CONTENT_FILES.includes(f));
    for (const file of files) {
      const matches = DATA_FILES.filter((d) => matchesPattern(file, d.pattern)).map((d) => d.schema);
      expect(matches, file).toHaveLength(1);
    }
  });

  it("maps every data file to the Zod schema the app parses it with", () => {
    for (const file of walk(dataDir)) {
      const spec = DATA_FILES.find((d) => matchesPattern(file, d.pattern));
      if (!spec) continue;
      const result = spec.zod.safeParse(JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8")));
      expect(result.success, `${file}: ${result.error?.message ?? ""}`).toBe(true);
    }
  });

  it("matches globs within one path segment", () => {
    expect(matchesPattern("persons/nadir-shah/person.json", "persons/*/person.json")).toBe(true);
    expect(matchesPattern("persons/a/b/person.json", "persons/*/person.json")).toBe(false);
    expect(matchesPattern("eras/sefevi.json", "eras/*.json")).toBe(true);
    expect(matchesPattern("erasXsefevi.json", "eras/*.json")).toBe(false);
  });
});

describe("redesign fields (B1), optional in content", () => {
  it("a step may name its template; unknown names are refused", async () => {
    const { StepTemplate } = await import("@/domain/schema");
    expect(StepTemplate.parse("battle")).toBe("battle");
    expect(() => StepTemplate.parse("cutscene")).toThrow();
  });
  it("an era weight is positive; subject is a slug", async () => {
    const { Era } = await import("@/domain/schema");
    const era = { id: "e", name: { az: "E" }, startYear: 1500, endYear: 1600, description: { az: "d" }, themeId: "default" };
    expect(Era.parse(era).weight).toBeUndefined();
    expect(Era.parse({ ...era, weight: 0.2, subject: "world-history" }).weight).toBe(0.2);
    expect(() => Era.parse({ ...era, weight: 0 })).toThrow();
    expect(() => Era.parse({ ...era, subject: "World History" })).toThrow();
  });
  it("a theme ui needs at least the ground and the accent", async () => {
    const { ThemeUi } = await import("@/domain/schema");
    expect(ThemeUi.parse({ bg: "#140E08", accent: "#E0B07A" })).toEqual({ bg: "#140E08", accent: "#E0B07A" });
    expect(() => ThemeUi.parse({ bg: "#140E08" })).toThrow();
    expect(() => ThemeUi.parse({ bg: "dark", accent: "#E0B07A" })).toThrow();
  });
});
