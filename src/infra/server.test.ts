/**
 * Runs the community server (`apps-script/wonder-pick.gs`) against stand-ins for the
 * Google services it uses: a sheet kept in memory, a cache, a lock. It checks the
 * protocol the page relies on, and that the server counts exactly what the page counts
 * for "Mine" (`aggregate`), so the two views can be compared figure for figure.
 */

import { describe, expect, it } from "vitest";
import source from "../../apps-script/wonder-pick.gs?raw";
import type { PickRecord } from "../domain/record";
import { aggregate } from "../domain/stats";

type Row = unknown[];

function server() {
  const rows: Row[] = [];
  const props: Record<string, string> = {};
  const cache = new Map<string, string>();
  const range = (r: number, c: number, nr = 1, nc = 1) => ({
    setValues(v: Row[]) {
      v.forEach((vals, i) => {
        while (rows.length < r + i) rows.push([]);
        vals.forEach((x, j) => (rows[r + i - 1]![c + j - 1] = x));
      });
      return this;
    },
    setValue(x: unknown) {
      rows[r - 1]![c - 1] = x;
    },
    getValues: () =>
      rows.slice(r - 1, r - 1 + nr).map((row) => Array.from({ length: nc }, (_, j) => row[c - 1 + j] ?? "")),
    setFontWeight() {
      return this;
    },
  });
  const sheet = {
    getLastRow: () => rows.length,
    getRange: range,
    setFrozenRows() {},
  };
  const g = {
    SpreadsheetApp: {
      create: () => ({ getId: () => "sheet1" }),
      openById: () => ({
        getSheetByName: () => (rows.length ? sheet : null),
        insertSheet: () => sheet,
        getUrl: () => "https://docs.google.com/spreadsheets/d/sheet1",
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props[k] ?? null,
        setProperty: (k: string, v: string) => (props[k] = v),
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => cache.get(k) ?? null,
        put: (k: string, v: string) => cache.set(k, v),
        removeAll: (ks: string[]) => ks.forEach((k) => cache.delete(k)),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 0 },
      Charset: { UTF_8: 0 },
      computeDigest: (_: unknown, s: string) => [...s].map((c) => c.charCodeAt(0) & 0xff),
      base64EncodeWebSafe: (b: number[]) =>
        btoa(String.fromCharCode(...b))
          .replace(/\+/g, "-")
          .replace(/\//g, "_"),
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (s: string) => ({ setMimeType: () => s }),
    },
    Logger: { log() {} },
  };
  const make = new Function(...Object.keys(g), source + "\nreturn { setup, doPost };");
  const api = make(...Object.values(g)) as { setup: () => void; doPost: (e: object) => string };
  api.setup();
  const call = (body: object) => JSON.parse(api.doPost({ postData: { contents: JSON.stringify(body) } }));
  return { call, rows, props };
}

const card = (no: number, r: string) => ({ no, name: "Card " + no, r });
function record(i: number, over: Partial<PickRecord> = {}): PickRecord {
  const after = [
    [2, 0, 1, 3, 4],
    [4, 3, 2, 1, 0],
    [0, 1, 2, 3, 4],
    [1, 2, 3, 4, 0],
  ][i % 4]!;
  return {
    id: "rec" + String(i).padStart(4, "0"),
    at: Date.now() - i * 24 * 3600_000,
    pack: i % 3 ? "A1" : "A2",
    cards: [card(1, "d1"), card(2, "d2"), card(3, "d3"), card(4, "d4"), card(5, "s1")] as PickRecord["cards"],
    want: [i % 5],
    get: (i * 2) % 5,
    after,
    ...over,
  };
}

const alice = { uid: "d:alice-device-01", key: "alice-secret" };
const bob = { uid: "d:bob-device-0001", key: "bob-secret" };

describe("community server", () => {
  it("creates its own sheet on setup", () => {
    const s = server();
    expect(s.props.sheetId).toBe("sheet1");
    expect(s.rows[0]![0]).toBe("id");
  });

  it("stores picks, gives each player back their own, and counts like the page", () => {
    const s = server();
    const a = Array.from({ length: 20 }, (_, i) => record(i));
    const b = Array.from({ length: 12 }, (_, i) => record(100 + i));
    expect(s.call({ action: "gc_push", ...alice, records: a }).saved).toHaveLength(20);
    expect(s.call({ action: "gc_push", ...bob, records: b }).saved).toHaveLength(12);

    expect(s.call({ action: "gc_mine", ...alice }).records).toHaveLength(20);
    const stats = s.call({ action: "gc_stats", pack: "" }).stats;
    const mine = aggregate([...a, ...b]);
    expect(stats.users).toBe(2);
    for (const k of ["n", "hit", "getN", "getHit", "wantAt", "moveAll", "moveWant", "rar", "packs"] as const)
      expect(stats[k]).toEqual(mine[k]);
    expect(stats.expect).toBeCloseTo(mine.expect);
    expect(s.call({ action: "gc_stats", pack: "A2" }).stats.n).toBe(aggregate([...a, ...b], "A2").n);
  });

  it("narrows to the last days and says so", () => {
    const s = server();
    const a = Array.from({ length: 40 }, (_, i) => record(i));
    s.call({ action: "gc_push", ...alice, records: a });
    const week = s.call({ action: "gc_stats", pack: "", days: 7 }).stats;
    expect(week.days).toBe(7);
    expect(week.n).toBe(aggregate(a, "", 7).n);
    expect(week.n).toBeLessThan(40);
    // An unknown period counts as all time, and says 0.
    expect(s.call({ action: "gc_stats", pack: "", days: 5 }).stats.days).toBe(0);
  });

  it("refuses another player's code, and forgets deleted picks", () => {
    const s = server();
    s.call({ action: "gc_push", ...alice, records: [record(1), record(2)] });
    expect(s.call({ action: "gc_push", uid: alice.uid, key: "wrong", records: [record(3)] }).error).toBe("bad_key");
    s.call({ action: "gc_push", ...alice, records: [{ ...record(1), deleted: true }] });
    expect(s.call({ action: "gc_mine", ...alice }).records).toHaveLength(1);
    expect(s.call({ action: "gc_stats", pack: "" }).stats.n).toBe(1);
  });

  it("refreshes the cached totals when a pick arrives", () => {
    const s = server();
    s.call({ action: "gc_push", ...alice, records: [record(1)] });
    expect(s.call({ action: "gc_stats", pack: "", days: 30 }).stats.n).toBe(1);
    s.call({ action: "gc_push", ...bob, records: [record(2)] });
    expect(s.call({ action: "gc_stats", pack: "", days: 30 }).stats.n).toBe(2);
  });
});
