import { describe, expect, it } from "vitest";
import { AnalyticsClient, MAX_BATCH, ownerOf, type AnalyticsEnv } from "@/lib/analytics/client";
import { quizOf } from "@/lib/analytics/quiz";
import { dataRoot, dataSource } from "@/data";
import { safePath } from "../../scripts/pull-content";

function env(overrides: Partial<AnalyticsEnv> = {}) {
  const sent: { url: string; body: unknown }[] = [];
  const scheduled: (() => void)[] = [];
  const store = new Map<string, string>();
  const e: AnalyticsEnv = {
    endpoint: "https://api.test/api/v1/events",
    now: () => new Date("2026-11-14T10:00:00Z"),
    randomId: () => "11111111-2222-4333-8444-555555555555",
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
    search: "",
    optedOut: false,
    send: (url, body) => void sent.push({ url, body: JSON.parse(body) }),
    schedule: (fn) => void scheduled.push(fn),
    ...overrides,
  };
  return { e, sent, scheduled, store };
}

describe("analytics client", () => {
  it("batches events and sends only the allowed fields", () => {
    const { e, sent, scheduled } = env();
    const c = new AnalyticsClient(e);
    c.track({ type: "simulation_started", ...ownerOf("person:shah-ismayil"), mode: "story" });
    c.track({ type: "step_viewed", ...ownerOf("person:shah-ismayil"), stepKey: "ismayil-birth" });
    expect(sent).toHaveLength(0);
    scheduled[0]!();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe("https://api.test/api/v1/events");
    expect(sent[0]!.body).toEqual({
      sessionId: "11111111-2222-4333-8444-555555555555",
      events: [
        { type: "simulation_started", ownerType: "person", ownerSlug: "shah-ismayil", mode: "story", occurredAt: "2026-11-14T10:00:00.000Z" },
        { type: "step_viewed", ownerType: "person", ownerSlug: "shah-ismayil", stepKey: "ismayil-birth", occurredAt: "2026-11-14T10:00:00.000Z" },
      ],
    });
  });

  it("never sends more than the server accepts in one batch", () => {
    const { e, sent } = env();
    const c = new AnalyticsClient(e);
    for (let i = 0; i < MAX_BATCH + 5; i++) c.track({ type: "legend_toggle", shown: true });
    expect(sent).toHaveLength(1);
    expect((sent[0]!.body as { events: unknown[] }).events).toHaveLength(MAX_BATCH);
    c.flush();
    expect((sent[1]!.body as { events: unknown[] }).events).toHaveLength(5);
  });

  it("keeps one random session per tab and a class code only from a teacher's link", () => {
    const { e, sent, store } = env({ search: "?class=k7mq2x" });
    const c = new AnalyticsClient(e);
    c.track({ type: "legend_toggle", shown: false });
    c.flush();
    expect(sent[0]!.body).toMatchObject({ classCode: "K7MQ2X" });
    expect(c.sessionId()).toBe(c.sessionId());
    expect([...store.values()]).toContain("11111111-2222-4333-8444-555555555555");

    const bad = env({ search: "?class=<script>" });
    new AnalyticsClient(bad.e).track({ type: "legend_toggle", shown: false });
    expect(bad.store.has("tarix.analytics.class")).toBe(false);
  });

  it("is off without an endpoint or when the browser asks not to be tracked", () => {
    for (const o of [{ endpoint: undefined }, { optedOut: true }]) {
      const { e, sent, scheduled } = env(o);
      const c = new AnalyticsClient(e);
      c.track({ type: "legend_toggle", shown: true });
      c.flush();
      expect(c.enabled).toBe(false);
      expect(sent).toHaveLength(0);
      expect(scheduled).toHaveLength(0);
    }
  });
});

describe("quiz questions remember their step", () => {
  it("tags each question with its step and position", () => {
    const q = { question: { az: "?" }, options: [{ az: "a" }, { az: "b" }], correctIndex: 0, explanation: { az: "." } };
    const tagged = quizOf([{ id: "s1", quiz: [q, q] }, { id: "s2" }, { id: "s3", quiz: [q] }]);
    expect(tagged.map((t) => [t.stepKey, t.questionIndex])).toEqual([["s1", 0], ["s1", 1], ["s3", 0]]);
  });
});

describe("data source", () => {
  it("reads data/ unless the build asks for the backend's export", () => {
    expect(dataSource(undefined)).toBe("static");
    expect(dataSource("static")).toBe("static");
    expect(dataSource("api")).toBe("api");
    expect(() => dataSource("http")).toThrow();
    expect(dataRoot("api", "/repo").replaceAll("\\", "/")).toBe("/repo/.content/data");
    expect(dataRoot("static", "/repo").replaceAll("\\", "/")).toBe("/repo/data");
  });

  it("pulls only export paths", () => {
    expect(safePath("data/places.json")).toBe(true);
    expect(safePath("data/persons/shah-ismayil/events.json")).toBe(true);
    expect(safePath("public/data/territories/y1501.json")).toBe(true);
    expect(safePath("../etc/passwd.json")).toBe(false);
    expect(safePath("data/../../x.json")).toBe(false);
    expect(safePath("public/index.html")).toBe(false);
    expect(safePath("/data/places.json")).toBe(false);
  });
});
