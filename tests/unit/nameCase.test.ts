import { describe, expect, it } from "vitest";
import { comitative, genitive } from "@/lib/nameCase";

describe("genitive of Azerbaijani names", () => {
  it.each([
    ["Şah İsmayıl", "Şah İsmayılın"],
    ["Uzun Həsən", "Uzun Həsənin"],
    ["Nadir Şah", "Nadir Şahın"],
    ["Xətai", "Xətainin"],
    ["Babək", "Babəkin"],
    ["Qorqud", "Qorqudun"],
    ["Füzuli", "Füzulinin"],
    ["Tomris", "Tomrisin"],
    ["Şuşa", "Şuşanın"],
    ["Bakı", "Bakının"],
    ["Ordubad", "Ordubadın"],
    ["Göyçə", "Göyçənin"],
    ["Mahmud", "Mahmudun"],
    ["Ömür", "Ömürün"],
    ["Quba", "Qubanın"],
    ["Əbu", "Əbunun"],
    ["Böyük", "Böyükün"],
  ])("%s → %s", (name, expected) => {
    expect(genitive(name)).toBe(expected);
  });

  it("leaves a name without vowels as it is", () => {
    expect(genitive("XYZ")).toBe("XYZ");
  });

  it("reads uppercase Azerbaijani vowels (I is ı, İ is i)", () => {
    expect(genitive("ŞAH İSMAYIL")).toBe("ŞAH İSMAYILın");
    expect(genitive("TƏBRİZ")).toBe("TƏBRİZin");
  });
});

describe("comitative of Azerbaijani names", () => {
  it.each([
    ["Uzun Həsən", "Uzun Həsənlə"],
    ["Şah İsmayıl", "Şah İsmayılla"],
    ["Nadir Şah", "Nadir Şahla"],
    ["Xətai", "Xətaiylə"],
    ["Şuşa", "Şuşayla"],
    ["Qorqud", "Qorqudla"],
    ["Füzuli", "Füzuliylə"],
    ["Ömür", "Ömürlə"],
  ])("%s → %s", (name, expected) => {
    expect(comitative(name)).toBe(expected);
  });
});
