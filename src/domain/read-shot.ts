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

import { MIX, PACKS, type Card } from "./catalog";
import { SIG_LEN, bestSimilarity, signatures, type Box, type Pixels } from "./screenshot";

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

  const slots = board.map((_, slot): SlotRead | null => {
    const { best, at } = bestIn(slot, pack);
    if (at < 0 || best < MIN_SCORE) return null;
    const k = known[at]!;
    const card = cardOf(k.pack, k.no);
    return card ? { card, pack: k.pack, score: best } : null;
  });
  return { pack: mixed ? MIX.code : (pack ?? PACKS[0]!.code), slots };
}

/**
 * Where each card of the board before the shuffle ended up, from a board read after
 * it: `after[p]` is the slot (0–4) the card now in `p` had before, or -1 when that card
 * is not one of the five. Cards are compared by name and rarity, so two copies of the
 * same card are told apart by position only as far as they can be.
 */
export function matchAfter(
  before: ({ name: string; r: string } | null)[],
  read: (SlotRead | null)[],
  localName: (c: Card) => string = (c) => c.name,
): number[] {
  const left = before.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  return read.map((s) => {
    if (!s) return -1;
    const k = left.findIndex((i) => before[i]!.name === localName(s.card) && before[i]!.r === s.card.r);
    if (k < 0) return -1;
    return left.splice(k, 1)[0]!;
  });
}
