import type { components } from "@/data/api/openapi";

/**
 * Anonymous learning events for the backend (BACKEND_SPEC.md §12, docs/adr/0018, 0020).
 *
 * Only what the event types allow is sent: no name, no account, no address. The session id is
 * a random UUID kept for this tab only (sessionStorage); a class code is sent only when the
 * student opened a teacher's link with `?class=…`. Off when NEXT_PUBLIC_ANALYTICS_URL is not
 * set (the static site without a backend) and when the browser asks not to be tracked.
 *
 * Events are batched (at most 50, the server's limit) and sent with `navigator.sendBeacon`
 * as text/plain: no CORS preflight, and the last batch still leaves when the page closes.
 */
export type LearningEvent = Omit<components["schemas"]["IncomingEvent"], "occurredAt">;

type Batch = components["schemas"]["EventBatch"];

export interface AnalyticsEnv {
  endpoint: string | undefined;
  now: () => Date;
  randomId: () => string;
  /** Per-tab storage (sessionStorage), or null. */
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  /** The page's query string, for `?class=`. */
  search: string;
  /** DNT or Global Privacy Control is on. */
  optedOut: boolean;
  send: (url: string, body: string) => void;
  schedule: (fn: () => void, ms: number) => unknown;
}

export const MAX_BATCH = 50;
export const FLUSH_AFTER_MS = 10_000;
const SESSION_KEY = "tarix.analytics.session";
const CLASS_KEY = "tarix.analytics.class";
const CLASS_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export class AnalyticsClient {
  private queue: components["schemas"]["IncomingEvent"][] = [];
  private timer: unknown = null;
  readonly enabled: boolean;

  constructor(private readonly env: AnalyticsEnv) {
    this.enabled = !!env.endpoint && !env.optedOut;
    if (this.enabled) this.rememberClass();
  }

  track(event: LearningEvent): void {
    if (!this.enabled) return;
    this.queue.push({ ...event, occurredAt: this.env.now().toISOString() });
    if (this.queue.length >= MAX_BATCH) this.flush();
    else if (this.timer === null) this.timer = this.env.schedule(() => this.flush(), FLUSH_AFTER_MS);
  }

  /** Sends what is queued (also called when the page is hidden or closed). */
  flush(): void {
    this.timer = null;
    while (this.queue.length > 0) {
      const events = this.queue.splice(0, MAX_BATCH);
      const batch: Batch = { sessionId: this.sessionId(), events };
      const code = this.classCode();
      if (code) batch.classCode = code;
      this.env.send(this.env.endpoint!, JSON.stringify(batch));
    }
  }

  sessionId(): string {
    const s = this.env.storage;
    let id = s?.getItem(SESSION_KEY) ?? null;
    if (!id) {
      id = this.env.randomId();
      s?.setItem(SESSION_KEY, id);
    }
    return id;
  }

  classCode(): string | null {
    return this.env.storage?.getItem(CLASS_KEY) ?? null;
  }

  /** `?class=k7mq2x` on any page: this tab's events count for that class. */
  private rememberClass(): void {
    const raw = new URLSearchParams(this.env.search).get("class");
    const code = raw?.trim().toUpperCase();
    if (code && CLASS_CODE.test(code)) this.env.storage?.setItem(CLASS_KEY, code);
  }
}

function browserEnv(): AnalyticsEnv {
  const w = typeof window === "undefined" ? undefined : window;
  const nav = w?.navigator as (Navigator & { globalPrivacyControl?: boolean }) | undefined;
  let storage: Storage | null = null;
  try {
    storage = w?.sessionStorage ?? null;
  } catch {
    storage = null;
  }
  return {
    endpoint: w ? process.env.NEXT_PUBLIC_ANALYTICS_URL || undefined : undefined,
    now: () => new Date(),
    randomId: () => crypto.randomUUID(),
    storage,
    search: w?.location.search ?? "",
    optedOut: !!nav && (nav.doNotTrack === "1" || nav.globalPrivacyControl === true),
    send: (url, body) => {
      const blob = new Blob([body], { type: "text/plain" });
      if (nav?.sendBeacon?.(url, blob)) return;
      void fetch(url, { method: "POST", body, headers: { "Content-Type": "text/plain" }, keepalive: true }).catch(() => {});
    },
    schedule: (fn, ms) => setTimeout(fn, ms),
  };
}

let client: AnalyticsClient | undefined;

function getClient(): AnalyticsClient {
  if (!client) {
    client = new AnalyticsClient(browserEnv());
    if (client.enabled && typeof document !== "undefined") {
      const flush = () => client!.flush();
      document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
      window.addEventListener("pagehide", flush);
    }
  }
  return client;
}

/** Records one event; a no-op on the server, without an endpoint, or when the browser opted out. */
export function track(event: LearningEvent): void {
  if (typeof window === "undefined") return;
  getClient().track(event);
}

/** Flushes now (e.g. before an event that ends the page's life). */
export function flushAnalytics(): void {
  if (typeof window === "undefined" || !client) return;
  client.flush();
}

/** `person:shah-ismayil` → the owner fields of an event. */
export function ownerOf(key: string): Pick<LearningEvent, "ownerType" | "ownerSlug"> {
  const [type, slug] = key.split(":", 2);
  return { ownerType: type, ownerSlug: slug };
}
