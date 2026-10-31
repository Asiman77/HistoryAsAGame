import { FileSystemRepository } from "./fileSystemRepository";
import type { HistoryRepository } from "./repository";

/**
 * The one place that decides where data comes from. To switch to a REST
 * backend, return an HttpRepository here (and drop `output: "export"` if
 * data must be fetched at runtime).
 */
let instance: HistoryRepository | undefined;

export function getRepository(): HistoryRepository {
  instance ??= new FileSystemRepository();
  return instance;
}

export type { HistoryRepository, PersonFilter } from "./repository";
