import { describe, expect, it } from "vitest";
import { PACKS } from "./catalog";
import { bestOrder, parseSigs, readBoard } from "./read-shot";
import {
  SIG_LEN,
  boardsFrom,
  findBoards,
  getMark,
  hourglass,
  signature,
  similarity,
  type Box,
  type Pixels,
} from "./screenshot";
import { samePick } from "./record";
// Through Vite, as a data URL: the project has no Node types to read files with.
import sigsUrl from "../../public/card-sigs.bin?inline";

const sigFile = () => {
  const bytes = Uint8Array.from(atob(sigsUrl.slice(sigsUrl.indexOf(",") + 1)), (c) => c.charCodeAt(0));
  return parseSigs(bytes.buffer);
};

/** A pale screenshot with the five cards three over two, each a flat pattern of its own. */
function fakeShot(cards: ((x: number, y: number) => [number, number, number])[], w = 540, h = 1000): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([236, 240, 246, 255], i * 4);
  const cw = 130,
    ch = Math.round(130 / (63 / 88));
  const at = [
    [60, 300],
    [205, 300],
    [350, 300],
    [132, 300 + ch + 20],
    [277, 300 + ch + 20],
  ];
  cards.forEach((paint, k) => {
    const [x0, y0] = at[k]!;
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) data.set([...paint(x / cw, y / ch), 255], ((y0! + y) * w + x0! + x) * 4);
  });
  return { width: w, height: h, data };
}

const pattern =
  (seed: number) =>
  (x: number, y: number): [number, number, number] => [
    (Math.sin(x * 9 + seed) * 0.5 + 0.5) * 200,
    (Math.cos(y * 7 + seed * 2) * 0.5 + 0.5) * 200,
    ((x * y * 5 + seed) % 1) * 200,
  ];

describe("screenshot", () => {
  it("finds the five cards in the game's order", () => {
    const boards = findBoards(fakeShot([0, 1, 2, 3, 4].map(pattern)));
    expect(boards).toHaveLength(1);
    [60, 205, 350, 132, 277].forEach((x, k) => expect(Math.abs(boards[0]![k]!.x - x)).toBeLessThan(4));
    expect(boards[0]![3]!.y).toBeGreaterThan(boards[0]![0]!.y);
  });

  it("puts back a card the background swallowed", () => {
    const box = (x: number, y: number): Box => ({ x, y, w: 100, h: 140 });
    const four = [box(0, 0), box(120, 0), box(240, 0), box(180, 160)];
    const [board] = boardsFrom(four);
    expect(board).toHaveLength(5);
    expect(board![3]!.x).toBeCloseTo(60);
  });

  it("ignores a row cut off at the edge of the picture", () => {
    const box = (x: number, y: number): Box => ({ x, y, w: 100, h: 140 });
    expect(boardsFrom([box(0, 0), box(240, 0)])).toEqual([]);
  });

  it("gives the same fingerprint to the same card brighter or duller", () => {
    const px = fakeShot([pattern(3)]);
    const box = findBoards(fakeShot([0, 1, 2, 3, 4].map(pattern)))[0]![0]!;
    const dim: Pixels = { ...px, data: px.data.map((v, i) => (i % 4 === 3 ? v : v * 0.8 + 10)) };
    expect(similarity(signature(px, box), signature(dim, box))).toBeGreaterThan(0.99);
  });
});

/** A flat picture with coloured rectangles painted on it. */
function paint(w: number, h: number, rects: [Box, [number, number, number]][]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([236, 240, 246, 255], i * 4);
  for (const [b, c] of rects)
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) data.set([...c, 255], (y * w + x) * 4);
  return { width: w, height: h, data };
}

describe("marks", () => {
  const card: Box = { x: 40, y: 60, w: 100, h: 140 };
  it("sees the teal GET mark over the card the player got", () => {
    const withMark = paint(200, 260, [
      [card, [230, 120, 60]],
      [{ x: 60, y: 48, w: 60, h: 20 }, [40, 190, 180]],
    ]);
    expect(getMark(withMark, card)).toBeGreaterThan(0.15);
    expect(getMark(paint(200, 260, [[card, [230, 120, 60]]]), card)).toBeLessThan(0.15);
  });

  it("tells the two hourglasses apart, and a card from both", () => {
    expect(hourglass(paint(200, 260, [[card, [240, 140, 30]]]), card)).toBe("wonder");
    expect(hourglass(paint(200, 260, [[card, [110, 90, 220]]]), card)).toBe("pack");
    expect(hourglass(paint(200, 260, [[card, [236, 240, 246]]]), card)).toBeNull();
  });

  it("knows a Wonder Pick logged twice", () => {
    const c = { no: 1, name: "Pikachu", r: "d1" as const };
    const a = { pack: "A1", cards: [c, c, c, c, c], after: [1, 0, 2, 3, 4] };
    expect(samePick(a, { ...a })).toBe(true);
    expect(samePick(a, { ...a, after: [0, 1, 2, 3, 4] })).toBe(false);
  });
});

describe("reading", () => {
  it("has a fingerprint for every card of every pack", () => {
    const known = sigFile();
    expect(known.length).toBe(PACKS.reduce((n, p) => n + p.cards.length, 0));
    expect(known[0]!.sig).toHaveLength(SIG_LEN);
  });

  it("reads a board drawn from known fingerprints back to its cards and pack", () => {
    // A screenshot whose cards are exactly the stored fingerprints of five A1 cards.
    const known = sigFile().filter((k) => k.pack === "A1" || k.pack === "A2");
    const five = [1, 33, 35, 94, 129].map((no) => known.find((k) => k.pack === "A1" && k.no === no)!);
    const board: Box[] = five.map((_, i) => ({ x: i * 200, y: 0, w: 184, h: 256 }));
    const px = paintSigs(
      five.map((k) => k.sig),
      board,
    );
    const read = readBoard(px, board, known);
    expect(read.pack).toBe("A1");
    expect(read.slots.map((s) => s?.card.no)).toEqual([1, 33, 35, 94, 129]);
  });

  it("works out where each card went after the shuffle, all five together", () => {
    // fit[p][i]: how well the card now in p fits the card that was in i. Card 0 and card 1
    // look alike; only the best overall order tells them apart.
    const fit = [0, 1, 2, 3, 4].map(() => [0.2, 0.2, 0.2, 0.2, 0.2]);
    const truth = [2, 0, 4, 1, 3];
    truth.forEach((i, p) => (fit[p]![i] = 0.95));
    fit[1]![1] = 0.9; // slot 1 holds card 0, but card 1 looks almost the same…
    fit[3]![0] = 0.9; // …and slot 3 holds card 1, which looks like card 0.
    expect(bestOrder(fit)).toEqual(truth);
  });
});

/** Paints each fingerprint's grid of colours over the artwork window of its box. */
function paintSigs(sigs: Int8Array[], boxes: Box[]): Pixels {
  const w = 1000,
    h = 256;
  const data = new Uint8ClampedArray(w * h * 4).fill(240);
  sigs.forEach((sig, k) => {
    const b = boxes[k]!;
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        const fx = x / b.w,
          fy = y / b.h;
        const gx = Math.min(11, Math.floor(((fx - 0.08) / 0.84) * 12));
        const gy = Math.min(6, Math.floor(((fy - 0.1) / 0.37) * 7));
        const i = ((b.y + y) * w + b.x + x) * 4;
        if (gx < 0 || gy < 0 || fy > 0.47 || fx > 0.92) data.set([128, 128, 128, 255], i);
        else for (let c = 0; c < 3; c++) data[i + c] = 128 + sig[(gy * 12 + gx) * 3 + c]! * 1.5;
        data[i + 3] = 255;
      }
  });
  return { width: w, height: h, data };
}
