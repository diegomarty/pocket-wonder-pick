/**
 * One Wonder Pick, as it is stored and as the optional server receives it.
 *
 * Positions are always 0–4 in the game's layout (see `POSITIONS`). `cards` is the
 * board *before* the shuffle; `after[p]` says which of those cards ended up in slot
 * `p` after it; `get` is the slot the player tapped. Keeping the whole permutation,
 * and not just "did I win", is what lets the stats ask where cards travel.
 */

import type { Rarity } from "./catalog";

export interface RecordCard {
  no: number;
  name: string;
  r: Rarity;
  /** Only kept while drafting, to draw the card; not stored. */
  hp?: number;
}

export interface PickRecord {
  id: string;
  at: number;
  pack: string;
  cards: (RecordCard | null)[];
  want: number[];
  get: number;
  after: number[];
  deleted?: boolean;
  /** Local bookkeeping for the server copy. */
  synced?: boolean;
  delSynced?: boolean;
}

export interface Draft {
  pack: string;
  cards: (RecordCard | null)[];
  want: number[];
  after: number[];
  get: number;
}

export const SLOTS = [0, 1, 2, 3, 4] as const;

export function newDraft(pack: string): Draft {
  return { pack, cards: [null, null, null, null, null], want: [], after: [-1, -1, -1, -1, -1], get: -1 };
}

export function isPermutation(a: readonly number[]): boolean {
  return a.length === 5 && SLOTS.every((x) => a.indexOf(x) >= 0);
}

/** Fills the last empty slot when the other four are known: there is only one card left. */
export function autoComplete(after: number[]): number[] {
  const empty = after.flatMap((v, i) => (v < 0 ? [i] : []));
  if (empty.length !== 1) return after;
  const missing = SLOTS.find((x) => !after.includes(x));
  if (missing === undefined) return after;
  const out = after.slice();
  out[empty[0]!] = missing;
  return out;
}

export type DraftProblem = "cards" | "want" | "after" | "get";

/** What still stops the draft from being saved, in the order the user meets it; `null` when ready. */
export function draftProblem(d: Draft): DraftProblem | null {
  if (d.cards.some((c) => !c)) return "cards";
  if (!d.want.length) return "want";
  if (!isPermutation(d.after)) return "after";
  if (d.get < 0) return "get";
  return null;
}

export function isHit(r: Pick<PickRecord, "want" | "after" | "get">): boolean {
  const got = r.after[r.get];
  return got !== undefined && r.want.includes(got);
}

export function newId(): string {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 16);
}

export function toRecord(d: Draft, at = Date.now()): PickRecord {
  return {
    id: newId(),
    at,
    pack: d.pack,
    cards: d.cards.map((c) => (c ? { no: c.no, name: c.name, r: c.r } : null)),
    want: d.want.slice().sort(),
    get: d.get,
    after: d.after.slice(),
  };
}

/**
 * Two logs of the same Wonder Pick: the same pack, the same five cards in the same
 * places, and the same shuffle. Saving one twice would count it twice in the stats.
 */
export function samePick(
  a: Pick<PickRecord, "pack" | "cards" | "after">,
  b: Pick<PickRecord, "pack" | "cards" | "after">,
): boolean {
  const key = (r: typeof a) =>
    r.pack + "|" + r.cards.map((c) => (c ? `${c.no}:${c.name}:${c.r}` : "-")).join(",") + "|" + r.after.join("");
  return key(a) === key(b);
}

/** Same rules the server applies; anything else in an imported file is dropped. */
export function validRecord(r: unknown): r is PickRecord {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== "string" || !/^[a-z0-9]{6,20}$/.test(o.id)) return false;
  if (typeof o.pack !== "string" || !/^[A-Za-z0-9-]{1,10}$/.test(o.pack)) return false;
  if (typeof o.at !== "number") return false;
  if (!Array.isArray(o.cards) || o.cards.length !== 5) return false;
  if (!Array.isArray(o.want) || !o.want.length || o.want.length > 5) return false;
  if (!o.want.every((w) => Number.isInteger(w) && w >= 0 && w < 5)) return false;
  if (!Number.isInteger(o.get) || (o.get as number) < 0 || (o.get as number) > 4) return false;
  return Array.isArray(o.after) && isPermutation(o.after as number[]);
}
