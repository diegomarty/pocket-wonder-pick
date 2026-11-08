/**
 * Everything this page keeps lives in the browser's localStorage, under one prefix.
 * Every access is guarded: private windows and blocked storage throw, and the page
 * must still work (it just forgets on reload).
 */

import { validRecord, type PickRecord } from "../domain/record";

const P = "pocketWonderPick:";

export const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(P + k);
      return v === null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown): void {
    try {
      localStorage.setItem(P + k, JSON.stringify(v));
    } catch {
      /* storage full or blocked: keep going in memory */
    }
  },
};

let mem: PickRecord[] | null = null;

export function loadRecords(): PickRecord[] {
  if (mem) return mem;
  const v = store.get<unknown[]>("records", []);
  mem = Array.isArray(v) ? v.filter(validRecord) : [];
  return mem;
}

export function saveRecords(list: PickRecord[]): void {
  mem = list.slice().sort((a, b) => b.at - a.at);
  store.set("records", mem);
}

/**
 * Who owns the records on the community server: a random id plus a random secret,
 * both made on this device. Copying the pair to another device (Ajustes) makes it
 * the same owner. No game ID, no social handle — nothing personal leaves the phone.
 */
export interface Owner {
  uid: string;
  key: string;
}

function randomToken(len: number): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}

export function owner(): Owner {
  let o = store.get<Owner | null>("owner", null);
  if (!o || !/^d:[\w-]{8,64}$/.test(o.uid) || typeof o.key !== "string") {
    o = { uid: "d:" + randomToken(20), key: randomToken(24) };
    store.set("owner", o);
  }
  return o;
}

/** The "link code" shown in settings: both halves, so another device can adopt them. */
export function ownerCode(o = owner()): string {
  return o.uid.slice(2) + "." + o.key;
}

export function adoptOwnerCode(code: string): boolean {
  const m = /^([\w-]{8,64})\.(\w{8,64})$/.exec(code.trim());
  if (!m) return false;
  const prev = owner();
  if (prev.uid === "d:" + m[1]) return true;
  // Remembered so the next push can hand this device's records over to the adopted owner.
  store.set("prevOwner", prev);
  store.set("owner", { uid: "d:" + m[1], key: m[2] });
  return true;
}

export function previousOwner(): Owner | null {
  return store.get<Owner | null>("prevOwner", null);
}

export function exportJson(): string {
  return JSON.stringify({ app: "pocket-wonder-pick", v: 1, records: loadRecords().filter((r) => !r.deleted) }, null, 1);
}

/** Merges by id; returns how many new records came in. */
export function importJson(text: string): number {
  const data = JSON.parse(text) as { records?: unknown[] } | unknown[];
  const list = Array.isArray(data) ? data : Array.isArray(data.records) ? data.records : [];
  const have = new Map(loadRecords().map((r) => [r.id, r]));
  let added = 0;
  for (const r of list) {
    if (!validRecord(r) || have.has(r.id)) continue;
    have.set(r.id, { ...r, synced: false, deleted: false });
    added++;
  }
  saveRecords([...have.values()]);
  return added;
}
