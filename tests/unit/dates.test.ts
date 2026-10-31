import { describe, expect, it } from "vitest";
import { ageAt, formatDate } from "@/lib/dates";
import { getMessages } from "@/lib/i18n";

describe("ageAt", () => {
  const birth = { year: 1487, month: 7, day: 17, certainty: "exact" as const };

  it("subtracts a year before the birthday", () => {
    expect(ageAt(birth, { year: 1501, month: 7, day: 1, certainty: "exact" })).toEqual({ years: 13, approximate: false });
    expect(ageAt(birth, { year: 1501, month: 7, day: 20, certainty: "exact" })).toEqual({ years: 14, approximate: false });
  });

  it("is approximate when precision or certainty is missing", () => {
    expect(ageAt(birth, { year: 1501, certainty: "exact" }).approximate).toBe(true);
    expect(ageAt({ year: 1423, certainty: "disputed" }, { year: 1478, month: 1, certainty: "exact" })).toEqual({
      years: 55,
      approximate: true,
    });
  });
});

describe("formatDate", () => {
  const m = getMessages("az");
  it("formats Azerbaijani dates", () => {
    expect(formatDate({ year: 1514, month: 8, day: 23, certainty: "exact" }, m)).toBe("23 avqust 1514");
    expect(formatDate({ year: 1423, certainty: "approximate" }, m)).toBe("təq. 1423");
  });
});
