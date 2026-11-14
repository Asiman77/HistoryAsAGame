import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";
import { expect, it } from "vitest";

/** The generated API types follow shared/openapi/public.json (written by the backend tests). */
it("src/data/api/openapi.ts is up to date (npm run api:types)", async () => {
  const spec = pathToFileURL(path.join(process.cwd(), "shared", "openapi", "public.json"));
  const generated = COMMENT_HEADER + astToString(await openapiTS(spec));
  const committed = fs.readFileSync(path.join(process.cwd(), "src", "data", "api", "openapi.ts"), "utf8");
  expect(committed.replaceAll("\r\n", "\n")).toBe(generated.replaceAll("\r\n", "\n"));
}, 30_000);
