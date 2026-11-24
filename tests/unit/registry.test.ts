import { describe, expect, it } from "vitest";
import { buildRegistry, checkRef, entityPath, resolveRef } from "@/domain/registry";

const reg = buildRegistry({
  simulations: [
    { type: "person", id: "nadir-shah", title: { az: "Nadir Şah" }, steps: [{ id: "nadir-mughan", title: { az: "Muğan" }, year: 1736 }] },
  ],
  others: [{ type: "place", id: "tebriz", title: { az: "Təbriz" } }],
  planned: [{ type: "state", id: "afshar", title: { az: "Əfşarlar dövləti" } }],
});

describe("registry", () => {
  it("builds deep links per simulation type", () => {
    expect(entityPath("state", "afshar", "1736-mughan")).toBe("/states/afshar/?step=1736-mughan");
    // Places have their own pages; rulers and battles still live inside other simulations.
    expect(entityPath("place", "tebriz")).toBe("/places/tebriz/");
    expect(entityPath("ruler", "x")).toBeNull();
  });

  it("resolves an existing ref to an active link with the step title", () => {
    const r = resolveRef({ type: "person", id: "nadir-shah", stepId: "nadir-mughan" }, reg);
    expect(r.href).toBe("/sexsiyyetler/nadir-shah/?step=nadir-mughan");
    expect(r.stepTitle?.az).toBe("Muğan");
  });

  it("keeps planned and missing refs passive, named by the registry or the ref label", () => {
    expect(resolveRef({ type: "state", id: "afshar", stepId: "1736-mughan" }, reg)).toMatchObject({ href: null, exists: false, title: { az: "Əfşarlar dövləti" } });
    expect(resolveRef({ type: "battle", id: "chaldiran-1514", label: { az: "Çaldıran" } }, reg)).toMatchObject({ href: null, title: { az: "Çaldıran" } });
  });

  it("warns about missing targets but fails on broken steps and nameless refs", () => {
    expect(checkRef({ type: "battle", id: "x", label: { az: "X" } }, reg, "e").map((i) => i.level)).toEqual(["warning"]);
    expect(checkRef({ type: "battle", id: "x" }, reg, "e").map((i) => i.level)).toEqual(["warning", "error"]);
    expect(checkRef({ type: "person", id: "nadir-shah", stepId: "nope" }, reg, "e").map((i) => i.level)).toEqual(["error"]);
    expect(checkRef({ type: "person", id: "nadir-shah", stepId: "nadir-mughan" }, reg, "e")).toEqual([]);
  });
});

describe("battles inside a conflict", () => {
  const r = buildRegistry({
    simulations: [],
    others: [{ type: "battle", id: "shusha-2020", title: { az: "Şuşa əməliyyatı" }, url: "/conflicts/karabakh-war-2020/?step=2020-11-08" }],
    planned: [],
  });
  it("link to the conflict day that shows them", () => {
    expect(resolveRef({ type: "battle", id: "shusha-2020" }, r).href).toBe("/conflicts/karabakh-war-2020/?step=2020-11-08");
  });
});
