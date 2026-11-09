/**
 * From the boards found on a screenshot to cards of the catalogue: which pack the
 * Wonder Pick is from, and which card sits in each slot.
 *
 * Every card is compared with every fingerprint in `public/card-sigs.bin`. The pack is
 * the one whose cards fit the five best together, so the user does not have to pick it
 * first; a mixed-list pick (cards from several packs) keeps the best card of any pack. A
 * slot whose best match is weak stays empty for the user to fill: better a gap than a
 * wrong card.
 */

import { ITEMS, MIX, PACKS, type Card } from "./catalog";
import { GET_MIN, SIG_LEN, bestSimilarity, getMark, hourglass, signatures, type Box, type Pixels } from "./screenshot";

export interface KnownSig {
  /** Pack code and card number. */
  pack: string;
  no: number;
  sig: Int8Array;
}

/** Below this a match is a guess (right ones score above 0.9; the best wrong one about 0.65). */
export const MIN_SCORE = 0.8;

/** Reads `card-sigs.bin` (layout in `scripts/card-signatures.mjs`). */
export function parseSigs(buf: ArrayBuffer): KnownSig[] {
  const v = new DataView(buf);
  const magic = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3));
  if (magic !== "WPS1" || v.getUint16(4, true) !== SIG_LEN) throw new Error("card-sigs.bin: unknown format");
  const n = v.getUint16(6, true);
  const rec = 8 + SIG_LEN;
  const codes = new Map(PACKS.map((p) => [p.code.toLowerCase(), p.code]));
  const out: KnownSig[] = [];
  for (let i = 0; i < n; i++) {
    const at = 8 + i * rec;
    const key = String.fromCharCode(...new Uint8Array(buf, at, 8)).replace(/\0+$/, "");
    const [set, no] = key.split("/");
    const pack = codes.get(set ?? "");
    if (!pack || !no) continue;
    out.push({ pack, no: Number(no), sig: new Int8Array(buf, at + 8, SIG_LEN) });
  }
  return out;
}

export interface SlotRead {
  card: Card;
  /** Where the card is in the catalogue, which a mixed-list card needs for its picture. */
  pack: string;
  score: number;
}

export interface ShotRead {
  /** The pack the five fit best, or MIX when asked for the mixed list. */
  pack: string;
  slots: (SlotRead | null)[];
  /**
   * The slot with the "GET" mark, or -1. With one, this is the result screen, after
   * the shuffle, and the mark says which card the player got.
   */
  get: number;
  /** Each slot's fingerprints, to match these cards with another screenshot's. */
  found: Float32Array[][];
}

const cardOf = (pack: string, no: number) => PACKS.find((p) => p.code === pack)?.cards.find((c) => c.no === no);

/**
 * Reads one board. `mixed` keeps the best card of any pack in each slot instead of
 * choosing one pack for all five.
 */
export function readBoard(px: Pixels, board: Box[], known: KnownSig[], mixed = false): ShotRead {
  const found = board.map((b) => signatures(px, b));
  // scores[slot][i] for known[i]; the int8 fingerprints are the real ones × 32.
  const scores = found.map((f) => known.map((k) => bestSimilarity(f, k.sig) / 32));

  const bestIn = (slot: number, pack: string | null) => {
    let best = -1,
      at = -1;
    scores[slot]!.forEach((s, i) => {
      if ((pack === null || known[i]!.pack === pack) && s > best) {
        best = s;
        at = i;
      }
    });
    return { best, at };
  };

  let pack: string | null = null;
  if (!mixed) {
    let top = -Infinity;
    for (const p of PACKS) {
      const total = board.reduce((sum, _, slot) => sum + Math.max(0, bestIn(slot, p.code).best), 0);
      if (total > top) {
        top = total;
        pack = p.code;
      }
    }
  }

  const slots = board.map((box, slot): SlotRead | null => {
    const { best, at } = bestIn(slot, pack);
    if (at < 0 || best < MIN_SCORE) {
      // No card fits: an hourglass, maybe.
      const kind = hourglass(px, box);
      const item = kind && ITEMS[kind === "wonder" ? 0 : 1];
      return item ? { card: item, pack: pack ?? "", score: 0 } : null;
    }
    const k = known[at]!;
    const card = cardOf(k.pack, k.no);
    return card ? { card, pack: k.pack, score: best } : null;
  });
  const marks = board.map((b) => getMark(px, b));
  const top = Math.max(...marks);
  return {
    pack: mixed ? MIX.code : (pack ?? PACKS[0]!.code),
    slots,
    get: top > GET_MIN ? marks.indexOf(top) : -1,
    found,
  };
}

/**
 * Where each card before the shuffle went, from how well each slot after it fits
 * each card before: `fit[p][i]` for the card now in `p` and the card that was in `i`.
 * Tries all 120 orders and keeps the one that fits best overall, so two similar
 * cards are told apart by the others. `after[p]` is the slot before (as in records).
 */
export function bestOrder(fit: number[][]): number[] {
  let best: number[] = [0, 1, 2, 3, 4],
    top = -Infinity;
  const walk = (p: number, used: number, cur: number[], sum: number) => {
    if (p === 5) {
      if (sum > top) {
        top = sum;
        best = cur.slice();
      }
      return;
    }
    for (let i = 0; i < 5; i++)
      if (!(used & (1 << i))) {
        cur[p] = i;
        walk(p + 1, used | (1 << i), cur, sum + (fit[p]![i] ?? 0));
      }
  };
  walk(0, 0, [], 0);
  return best;
}
