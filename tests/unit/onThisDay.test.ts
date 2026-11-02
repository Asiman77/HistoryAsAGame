import { describe, expect, it } from "vitest";
import { FileSystemRepository } from "@/data/fileSystemRepository";
import type { IndexedEvent } from "@/lib/historyIndex";
import { commemorationOn, onThisDay, todayFrom } from "@/lib/onThisDay";

const ev = (key: string, year: number, month?: number, day?: number) =>
  ({ key, date: { year, ...(month ? { month } : {}), ...(day ? { day } : {}), certainty: "exact" } }) as IndexedEvent;

describe("onThisDay", () => {
  const index = [ev("a", 1514, 8, 23), ev("b", 1739, 8), ev("c", 2020, 8, 23), ev("d", 1600, 3, 1)];
  it("uses only day-precision events for the day, oldest first", () => {
    const r = onThisDay(index, { month: 8, day: 23 });
    expect(r.mode).toBe("day");
    expect(r.events.map((e) => e.key)).toEqual(["a", "c"]);
  });
  it("falls back to the month, with dated events first", () => {
    const r = onThisDay(index, { month: 8, day: 1 });
    expect(r.mode).toBe("month");
    expect(r.events.map((e) => e.key)).toEqual(["a", "c", "b"]);
  });
  it("says so when the month is empty", () => {
    expect(onThisDay(index, { month: 12, day: 1 }).mode).toBe("none");
  });
  it("reads ?today=MM-DD for previews, else the visitor's date", () => {
    expect(todayFrom("?today=09-27", new Date(2026, 10, 2))).toEqual({ month: 9, day: 27 });
    expect(todayFrom("", new Date(2026, 10, 2))).toEqual({ month: 11, day: 2 });
    expect(todayFrom("?today=13-40", new Date(2026, 10, 2))).toEqual({ month: 11, day: 2 });
  });
});

describe("data", async () => {
  const repo = new FileSystemRepository();
  const [index, days] = await Promise.all([repo.getHistoryIndex(), repo.listCommemorations()]);
  it("27 Sentyabr and 8 Noyabr are special days with their war steps", () => {
    expect(commemorationOn(days, { month: 9, day: 27 })?.style).toBe("memorial");
    expect(commemorationOn(days, { month: 11, day: 8 })?.style).toBe("victory");
    expect(onThisDay(index, { month: 11, day: 8 }).events.map((e) => e.stepId)).toContain("2020-11-08");
  });
  it("23 avqust brings Çaldıran", () => {
    expect(onThisDay(index, { month: 8, day: 23 }).events.map((e) => e.stepId)).toContain("ismayil-chaldiran");
  });
});
