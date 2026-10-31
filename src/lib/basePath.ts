/**
 * Sub-path the site is served from (e.g. "/HistoryAsAGame" on GitHub Pages).
 * next/link and the router add it automatically; plain asset URLs need it.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(url: string): string {
  return url.startsWith("/") ? `${BASE_PATH}${url}` : url;
}
