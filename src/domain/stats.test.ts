import { describe, expect, it } from "vitest";
import { MIX, PACKS, cardArt, fold, localName, searchCards } from "./catalog";
import { autoComplete, draftProblem, isHit, newDraft, toRecord, validRecord, type PickRecord } from "./record";
import { aggregate, chiSquare, predict } from "./stats";

const card = { no: 1, name: "Bulbasaur", r: "d1" as const };
const rec = (over: Partial<PickRecord>): PickRecord => ({
  id: "abc123",
  at: 1,
  pack: "A1",
  cards: [card, card, { ...card, r: "s1" }, card, card],
  want: [2],
  get: 0,
  after: [2, 0, 1, 3, 4],
  ...over,
});

describe("record", () => {
  it("fills the last slot once four are known", () => {
    expect(autoComplete([4, 3, -1, 1, 0])).toEqual([4, 3, 2, 1, 0]);
    expect(autoComplete([4, -1, -1, 1, 0])).toEqual([4, -1, -1, 1, 0]);
  });

  it("walks the user through what is missing", () => {
    const d = newDraft("A1");
    expect(draftProblem(d)).toBe("cards");
    d.cards = [card, card, card, card, card];
    expect(draftProblem(d)).toBe("want");
    d.want = [1];
    expect(draftProblem(d)).toBe("after");
    d.after = [0, 1, 2, 3, 4];
    expect(draftProblem(d)).toBe("get");
    d.get = 1;
    expect(draftProblem(d)).toBeNull();
    const r = toRecord(d);
    expect(validRecord(r)).toBe(true);
    expect(isHit(r)).toBe(true);
  });

  it("rejects malformed imports", () => {
    expect(validRecord(rec({ after: [0, 0, 1, 2, 3] }))).toBe(false);
    expect(validRecord(rec({ want: [] }))).toBe(false);
    expect(validRecord(rec({ id: "NO" }))).toBe(false);
    expect(validRecord(rec({}))).toBe(true);
  });
});

describe("stats", () => {
  it("counts hits, expectation and moves", () => {
    const S = aggregate([rec({}), rec({ get: 1 }), rec({ deleted: true })]);
    expect(S.n).toBe(2);
    expect(S.hit).toBe(1); // slot 0 held card 2
    expect(S.expect).toBeCloseTo(0.4);
    expect(S.moveAll[2]![0]).toBe(2);
    expect(S.rar["★1"]).toEqual([2, 1]);
    expect(S.packs.A1).toEqual([2, 1]);
  });

  it("filters by pack", () => {
    expect(aggregate([rec({}), rec({ pack: "B1" })], "B1").n).toBe(1);
  });

  it("predicts from the wanted rows and caps at 100%", () => {
    const S = aggregate([rec({}), rec({})]);
    const P = predict(S.moveAll, [2]);
    expect(P?.best).toBe(0);
    expect(P?.p[0]).toBe(1);
    expect(predict(S.moveAll, [2, 0])!.p.every((v) => v <= 1)).toBe(true);
    expect(predict(aggregate([]).moveAll, [1])).toBeNull();
  });

  it("measures skew", () => {
    expect(chiSquare([10, 10, 10, 10, 10])).toBe(0);
    expect(chiSquare([50, 0, 0, 0, 0])).toBeGreaterThan(9.488);
  });
});

describe("catalog", () => {
  it("has every pack, in English by default, without ☆3/shiny/crown", () => {
    expect(PACKS.length).toBe(23);
    const a1 = PACKS.find((p) => p.code === "A1")!;
    expect(a1.name).toBe("Genetic Apex");
    expect(a1.cards[0]!.name).toBe("Bulbasaur");
    expect(PACKS.every((p) => p.cards.every((c) => !/[぀-ヿ一-鿿]/.test(c.name)))).toBe(true);
  });

  it("searches both languages, without accents, and by number", () => {
    expect(searchCards(MIX.cards, "profesora olim").length).toBeGreaterThan(0);
    expect(fold("Investigación de Profesores")).toBe("investigacion de profesores");
    expect(searchCards(MIX.cards, "investigacion").length).toBeGreaterThan(0);
    const a1 = PACKS.find((p) => p.code === "A1")!;
    expect(searchCards(a1.cards, "1")[0]!.no).toBe(1);
  });

  it("renders saved names in the page language", () => {
    expect(localName("Profesora Olim", "d2")).toBe("Professor Sada");
    expect(localName("Unknown card", "d1")).toBe("Unknown card");
  });

  it("knows each card's type and filters by it", () => {
    const a1 = PACKS.find((p) => p.code === "A1")!;
    expect(a1.cards.every((c) => c.type)).toBe(true);
    expect(a1.cards[0]!.type).toBe("G");
    const fire = searchCards(a1.cards, "", "", "R");
    expect(fire.length).toBeGreaterThan(0);
    expect(fire.every((c) => c.type === "R")).toBe(true);
    expect(searchCards(a1.cards, "", "d4", "R").every((c) => c.r === "d4" && c.type === "R")).toBe(true);
    // Cards with no HP are trainers, even in packs the type list does not cover.
    expect(PACKS.every((p) => p.cards.every((c) => c.hp || c.type === "T"))).toBe(true);
  });

  it("finds a card's picture by pack and number, or by name", () => {
    expect(cardArt("A1", { no: 1, name: "Bulbasaur", r: "d1" })).toBe("a1/001");
    // Mixed list, or a card kept after switching packs: found by name, in either language.
    expect(cardArt("MIX", { no: 1, name: "Bulbasaur", r: "d1" })).toMatch(/^[a-c]\d[a-z]?\/\d{3}$/);
    expect(cardArt("MIX", { no: 1, name: "Profesora Olim", r: "d2" })).not.toBeNull();
    expect(cardArt("A1", { no: 0, name: "Hand-typed", r: "d1" })).toBeNull();
    expect(cardArt("X", { no: 0, name: "Wonder Hourglass", r: "item" })).toBeNull();
  });
});
