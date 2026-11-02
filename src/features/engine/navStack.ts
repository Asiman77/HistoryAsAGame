"use client";

/**
 * Return path for cross-links: before following a link into another
 * simulation we remember where we were (page + step), so the target can offer
 * "← back to Şah İsmayıl, Çaldıran". Kept in sessionStorage (per tab).
 */
export interface ReturnEntry {
  /** Where to go back to, without locale, e.g. "/persons/shah-ismayil/?step=ismayil-chaldiran". */
  href: string;
  /** "Şah İsmayıl · Çaldıran döyüşü (1514)" */
  label: string;
  /** Path (without locale and query) of the page the link led to. */
  target: string;
}

const KEY = "tarix:navstack";
const MAX = 20;

function read(): ReturnEntry[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReturnEntry[]) : [];
  } catch {
    return [];
  }
}

function write(stack: ReturnEntry[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-MAX)));
  } catch {}
}

export function pushReturn(entry: ReturnEntry) {
  write([...read(), entry]);
}

/** The return entry for this page, if we arrived here through a cross-link. */
export function peekReturn(currentPath: string): ReturnEntry | null {
  const top = read().at(-1);
  return top && top.target === currentPath ? top : null;
}

export function popReturn(): ReturnEntry | null {
  const stack = read();
  const top = stack.pop() ?? null;
  write(stack);
  return top;
}

/** Strips the locale prefix and query: "/az/persons/x/?step=y" → "/persons/x/". */
export function pathOf(href: string): string {
  const noQuery = href.split("?")[0]!;
  return noQuery.replace(/^\/[a-z]{2}(?=\/)/, "");
}
