/**
 * Everything the stats tab and the prediction read, counted from a list of picks.
 *
 * The shape is the one the optional server returns too (see `apps-script/`), so the
 * "mine" and "community" views draw from the same function.
 */

import { RARITY_GROUP } from "./catalog";
import { isPermutation, type PickRecord } from "./record";

export type Matrix = number[][];

export interface Stats {
  n: number;
  hit: number;
  /** Sum of the per-pick odds of a blind tap: how many hits pure chance would give. */
  expect: number;
  getN: number[];
  getHit: number[];
  wantAt: number[];
  wantN: number;
  /** moveAll[before][after]: how often a card in slot `before` landed in slot `after`. */
  moveAll: Matrix;
  moveWant: Matrix;
  rar: Record<string, [number, number]>;
  packs: Record<string, [number, number]>;
  users?: number;
}

const zero5 = () => [0, 0, 0, 0, 0];
const zeroM = (): Matrix => [zero5(), zero5(), zero5(), zero5(), zero5()];

export function emptyStats(): Stats {
  return {
    n: 0,
    hit: 0,
    expect: 0,
    getN: zero5(),
    getHit: zero5(),
    wantAt: zero5(),
    wantN: 0,
    moveAll: zeroM(),
    moveWant: zeroM(),
    rar: {},
    packs: {},
  };
}

export function aggregate(list: readonly PickRecord[], packCode = ""): Stats {
  const S = emptyStats();
  for (const r of list) {
    if (r.deleted || (packCode && r.pack !== packCode)) continue;
    const A = r.after;
    if (!isPermutation(A) || r.get < 0 || r.get > 4) continue;
    const got = A[r.get]!;
    const hit = r.want.includes(got);
    S.n++;
    if (hit) S.hit++;
    S.expect += r.want.length / 5;
    S.getN[r.get]!++;
    if (hit) S.getHit[r.get]!++;
    for (let p = 0; p < 5; p++) S.moveAll[p]![A.indexOf(p)]!++;
    for (const w of r.want) {
      const d = A.indexOf(w);
      S.wantAt[d]!++;
      S.wantN++;
      S.moveWant[w]![d]!++;
      const card = r.cards[w];
      const g = (card && RARITY_GROUP[card.r]) || "?";
      const row = (S.rar[g] ??= [0, 0]);
      row[0]++;
      if (got === w) row[1]++;
    }
    const pk = (S.packs[r.pack] ??= [0, 0]);
    pk[0]++;
    if (hit) pk[1]++;
  }
  return S;
}

export interface Prediction {
  /** Chance, per slot after the shuffle, that one of the wanted cards is there. */
  p: number[];
  best: number;
  /** Fewest samples behind any of the wanted rows: how much to trust it. */
  n: number;
}

/**
 * Where the wanted cards are likely to be after the shuffle, from past moves.
 *
 * With several wanted cards the per-card odds add up (they cannot share a slot),
 * capped at 100%. `null` when no wanted slot has any history yet.
 */
export function predict(moveAll: Matrix, want: readonly number[]): Prediction | null {
  const p = zero5();
  let n = Infinity;
  let used = 0;
  for (const w of want) {
    const row = moveAll[w] ?? zero5();
    const sum = row.reduce((a, b) => a + b, 0);
    n = Math.min(n, sum);
    if (!sum) continue;
    used++;
    row.forEach((v, j) => (p[j]! += v / sum));
  }
  if (!used) return null;
  const q = p.map((v) => Math.min(1, v));
  const max = Math.max(...q);
  return { p: q, best: q.indexOf(max), n: Number.isFinite(n) ? n : 0 };
}

/**
 * How far a row of counts strays from an even split, as Pearson's chi-squared with
 * four degrees of freedom. Above ~9.49 the skew would happen by chance less than 5%
 * of the time — a hint that the shuffle is not uniform, not a proof.
 */
export function chiSquare(row: readonly number[]): number {
  const total = row.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const e = total / row.length;
  return row.reduce((acc, o) => acc + ((o - e) * (o - e)) / e, 0);
}
export const CHI2_CRITICAL_4DF = 9.488;
