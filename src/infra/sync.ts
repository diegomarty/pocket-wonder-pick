/**
 * The optional community server: a Google Apps Script web app writing to a sheet.
 *
 * Off until a URL is set in Ajustes. It speaks the same protocol as the Japanese
 * tool this page is modelled on (`gc_push`, `gc_mine`, `gc_stats`), so the script in
 * `apps-script/wonder-pick.gs` is a translated copy of theirs. Requests are
 * `text/plain` on purpose: that keeps them "simple" and avoids a CORS preflight,
 * which Apps Script cannot answer.
 */

import type { PickRecord } from "../domain/record";
import { isPermutation } from "../domain/record";
import type { Stats } from "../domain/stats";
import { loadRecords, owner, previousOwner, saveRecords, store } from "./storage";

const STATS_TTL_MS = 10 * 60_000;
const MINE_TTL_MS = 24 * 3600_000;

export function serverUrl(): string {
  return store.get("server", "");
}

export function setServerUrl(url: string): void {
  store.set("server", url.trim());
  store.set("statsCache", {});
  store.set("lastMine", 0);
}

export function isValidServerUrl(url: string): boolean {
  return /^https:\/\/script\.google(usercontent)?\.com\/.+/.test(url.trim());
}

async function api<T>(body: object, timeoutMs = 20_000, url = serverUrl()): Promise<T> {
  if (!url) throw new Error("no_server");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function ping(url: string): Promise<boolean> {
  try {
    const r = await api<{ ok?: boolean }>({ action: "gc_stats", pack: "" }, 20_000, url);
    return !!r && r.ok === true;
  } catch {
    return false;
  }
}

const sendable = (r: PickRecord) => isPermutation(r.after) && r.want.length > 0 && r.get >= 0 && r.get < 5;

let pushing = false;

/** Sends what the server has not seen yet. Never throws: offline just means "later". */
export async function pushPending(): Promise<"none" | "ok" | "error" | "bad_key"> {
  if (!serverUrl() || pushing) return "none";
  const pend = loadRecords().filter((r) => (!r.synced && !r.deleted && sendable(r)) || (r.deleted && !r.delSynced));
  if (!pend.length) return "none";
  pushing = true;
  try {
    const o = owner();
    const prev = previousOwner();
    const batch = pend.slice(0, 50);
    const r = await api<{ ok: boolean; saved?: string[]; error?: string }>(
      {
        action: "gc_push",
        uid: o.uid,
        key: o.key,
        // Proof that this device owned its older records, so the server moves them over.
        ...(prev ? { moveFrom: prev.uid, moveKey: prev.key } : {}),
        records: batch.map((x) => ({
          id: x.id,
          at: x.at,
          pack: x.pack,
          cards: x.cards,
          want: x.want,
          get: x.get,
          after: x.after,
          deleted: !!x.deleted,
        })),
      },
      25_000,
    );
    if (!r.ok) return r.error === "bad_key" ? "bad_key" : "error";
    const done = new Set(r.saved ?? []);
    saveRecords(
      loadRecords()
        .map((x) => (done.has(x.id) ? { ...x, synced: true, delSynced: !!x.deleted } : x))
        .filter((x) => !(x.deleted && x.delSynced)),
    );
    store.set("statsCache", {});
    return "ok";
  } catch {
    return "error";
  } finally {
    pushing = false;
  }
}

/** Pulls this owner's records made on other devices, at most once a day unless forced. */
export async function pullMine(force = false): Promise<number> {
  if (!serverUrl()) return 0;
  if (!force && Date.now() - store.get("lastMine", 0) < MINE_TTL_MS) return 0;
  const o = owner();
  try {
    const r = await api<{ ok: boolean; records?: PickRecord[] }>({ action: "gc_mine", uid: o.uid, key: o.key }, 25_000);
    if (!r.ok) return 0;
    const have = new Map(loadRecords().map((x) => [x.id, x]));
    let added = 0;
    for (const x of r.records ?? []) {
      if (have.has(x.id)) continue;
      have.set(x.id, { ...x, synced: true });
      added++;
    }
    saveRecords([...have.values()]);
    store.set("lastMine", Date.now());
    return added;
  } catch {
    return 0;
  }
}

type StatsCache = Record<string, { at: number; data: Stats }>;

export function cachedCommunityStats(pack: string): Stats | null {
  const c = store.get<StatsCache>("statsCache", {})[pack || "_"];
  return c ? c.data : null;
}

export async function communityStats(pack: string): Promise<Stats> {
  const cache = store.get<StatsCache>("statsCache", {});
  const k = pack || "_";
  const c = cache[k];
  if (c && Date.now() - c.at < STATS_TTL_MS) return c.data;
  const r = await api<{ ok: boolean; stats?: Stats }>({ action: "gc_stats", pack }, 25_000);
  if (!r.ok || !r.stats) throw new Error("bad_stats");
  cache[k] = { at: Date.now(), data: r.stats };
  store.set("statsCache", cache);
  return r.stats;
}
