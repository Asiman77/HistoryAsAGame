import { describe, expect, it } from "vitest";
import { FileSystemRepository } from "@/data/fileSystemRepository";
import { Claim } from "@/domain/schema";
import { buildJourney } from "@/features/simulation/model";
import { classifyItems, pickRound } from "@/lib/claims";

const src = { title: "X", type: "book" as const };

describe("Claim schema", () => {
  it("rejects a fact without a source", () => {
    expect(Claim.safeParse({ id: "a", claimType: "fact", text: { az: "x" }, sources: [] }).success).toBe(false);
    expect(Claim.safeParse({ id: "a", claimType: "fact", text: { az: "x" }, sources: [src] }).success).toBe(true);
  });
  it("needs where a legend was first recorded and why it is a legend", () => {
    const base = { id: "a", claimType: "legend", text: { az: "x" }, sources: [] };
    expect(Claim.safeParse({ ...base, why: { az: "y" } }).success).toBe(false);
    expect(Claim.safeParse({ ...base, firstRecorded: { source: src } }).success).toBe(false);
    expect(Claim.safeParse({ ...base, why: { az: "y" }, firstRecorded: { source: src } }).success).toBe(true);
  });
  it("needs at least two versions for a disputed claim", () => {
    const v = { text: { az: "v" }, sources: [src] };
    const base = { id: "a", claimType: "disputed", text: { az: "x" }, why: { az: "y" }, sources: [] };
    expect(Claim.safeParse({ ...base, versions: [v] }).success).toBe(false);
    expect(Claim.safeParse({ ...base, versions: [v, v] }).success).toBe(true);
  });
});

describe("Fakt yoxsa rəvayət?", () => {
  const steps = [
    {
      title: { az: "A" },
      claims: [
        { id: "f1", claimType: "fact" as const, text: { az: "f1" }, sources: [src] },
        { id: "l1", claimType: "legend" as const, text: { az: "l1" }, why: { az: "w" }, sources: [], firstRecorded: { source: src } },
        { id: "t1", claimType: "literary" as const, text: { az: "t1" }, sources: [] },
      ],
    },
    { title: { az: "B" }, claims: [{ id: "f2", claimType: "fact" as const, text: { az: "f2" }, sources: [src] }] },
  ];
  it("never asks about literary text and keeps the explanation and source", () => {
    const items = classifyItems(steps);
    expect(items.map((i) => i.id).sort()).toEqual(["f1", "f2", "l1"]);
    const legend = items.find((i) => i.id === "l1")!;
    expect(legend.answer).toBe("legend");
    expect(legend.explanation).toEqual({ az: "w" });
    expect(legend.source).toEqual(src);
  });
  it("mixes kinds in a round and is stable for a seed", () => {
    const items = classifyItems(steps);
    const a = pickRound(items, 2, 7);
    expect(new Set(a.map((i) => i.answer)).size).toBe(2);
    expect(pickRound(items, 3, 7).map((i) => i.id)).toEqual(pickRound(items, 3, 7).map((i) => i.id));
  });
});

describe("classified data", async () => {
  const repo = new FileSystemRepository();
  const eras = await repo.listEras();
  const nadir = buildJourney((await repo.getPerson("nadir-shah"))!, await repo.getEvents("nadir-shah"), eras);
  const ismayil = buildJourney((await repo.getPerson("shah-ismayil"))!, await repo.getEvents("shah-ismayil"), eras);

  it("Nadir's Uzbek captivity is a legend with its first record", () => {
    const step = nadir.steps.find((s) => s.id === "nadir-captivity")!;
    expect(step.claimType).toBe("legend");
    expect(step.claims[0]!.firstRecorded).toBeDefined();
  });
  it("Şah İsmayıl's childhood carries a legend and a disputed point; other steps default to fact", () => {
    const kinds = new Set(ismayil.steps.flatMap((s) => s.claims.map((c) => c.claimType)));
    expect(kinds).toEqual(new Set(["fact", "legend", "disputed"]));
    expect(ismayil.steps.find((s) => s.id === "ismayil-birth")!.claimType).toBe("fact");
  });
  it("each person has enough statements for a quiz round", () => {
    for (const j of [nadir, ismayil]) expect(classifyItems(j.steps).length).toBeGreaterThanOrEqual(2);
  });
});
