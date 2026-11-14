import path from "node:path";
import { FileSystemRepository } from "./fileSystemRepository";
import type { HistoryRepository } from "./repository";

/** Where the build reads content from (docs/adr/0020). */
export type DataSource = "static" | "api";

/**
 * `static` (default): the repository's data/ folder.
 * `api`: the backend's published content, pulled from its static export into .content/
 * by `npm run content:pull` (`npm run build:api` does both). The export has the data/
 * format and passes the same Zod schemas, so the same repository reads it.
 */
export function dataSource(env: string | undefined = process.env.NEXT_PUBLIC_DATA_SOURCE): DataSource {
  if (env === undefined || env === "" || env === "static") return "static";
  if (env === "api") return "api";
  throw new Error(`NEXT_PUBLIC_DATA_SOURCE: "static" or "api", not "${env}"`);
}

/** The data folder for a source. */
export function dataRoot(source: DataSource, cwd: string = process.cwd()): string {
  return source === "api" ? path.join(cwd, ".content", "data") : path.join(cwd, "data");
}

/** The one place that decides where data comes from. */
let instance: HistoryRepository | undefined;

export function getRepository(): HistoryRepository {
  instance ??= new FileSystemRepository(dataRoot(dataSource()));
  return instance;
}

export type { HistoryRepository, PersonFilter } from "./repository";
