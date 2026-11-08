/**
 * Servidor de la comunidad para el Registro de Elecciones Milagrosas (index.html).
 *
 * Opcional: sin él, la página guarda todo en el dispositivo. Con él, los registros de
 * todos se juntan en una hoja de cálculo y la pestaña «Comunidad» muestra el total.
 *
 * Adaptado del Apps Script de ゲットチャレンジ de card-request-box (mismo protocolo:
 * gc_push / gc_mine / gc_stats), traducido y sin la parte de reconocimiento de capturas.
 *
 * Cómo montarlo:
 *   1. Crea una hoja de cálculo de Google y copia su ID (lo que va entre /d/ y /edit).
 *   2. Extensiones → Apps Script. Pega este archivo entero y pon el ID en SHEET_ID.
 *   3. Ejecuta `setup` una vez (pedirá permisos) para crear la pestaña.
 *   4. Implementar → Nueva implementación → Aplicación web.
 *      Ejecutar como: «Yo». Quién tiene acceso: «Cualquier usuario».
 *   5. Copia la URL que acaba en /exec y pégala en Ajustes de la página.
 */

const SHEET_ID = "PON_AQUI_EL_ID_DE_TU_HOJA";

const SHEET = "Elecciones";
const HEAD = ["id", "fecha", "dueño", "clave", "sobre", "cartas antes", "quería (antes)", "elegida (después)", "después (origen por posición)", "acierto", "borrado"];
const MAX_PUSH = 50;
const STATS_CACHE_SEC = 600;
const RG = { d1: "◆1–2", d2: "◆1–2", d3: "◆3", d4: "◆4", s1: "★1", s2: "★2", item: "item" };

function doGet() {
  return json({ ok: true, app: "elecciones" });
}

function doPost(e) {
  let b = {};
  try { b = JSON.parse((e.postData && e.postData.contents) || "{}"); } catch (err) { return json({ ok: false, error: "bad_json" }); }
  try {
    if (b.action === "gc_push") return json(push(b));
    if (b.action === "gc_mine") return json(mine(b));
    if (b.action === "gc_stats") return json({ ok: true, stats: stats(String(b.pack || "")) });
    return json({ ok: false, error: "bad_action" });
  } catch (err) {
    return json({ ok: false, error: String((err && err.message) || err) });
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function setup() {
  sheet();
  Logger.log("Listo: " + SpreadsheetApp.openById(SHEET_ID).getUrl());
}

function sheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

// La clave nunca se guarda tal cual: solo su hash.
function hash(s) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "gc:" + String(s || ""), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(raw).slice(0, 22);
}

// Un texto que empieza por = + - @ se leería como fórmula: se guarda con ' delante.
function txt(v) { v = String(v); return /^[=+\-@']/.test(v) ? "'" + v : v; }
function untxt(v) { return String(v).replace(/^'/, ""); }

function cleanUid(u) {
  u = String(u || "");
  return /^d:[\w-]{8,64}$/.test(u) ? u : "";
}

function validRecord(r) {
  if (!r || typeof r.id !== "string" || !/^[a-z0-9]{6,20}$/.test(r.id)) return false;
  if (!/^[A-Za-z0-9-]{1,10}$/.test(String(r.pack || ""))) return false;
  if (!Array.isArray(r.cards) || r.cards.length !== 5) return false;
  if (!Array.isArray(r.want) || !r.want.length || r.want.length > 5) return false;
  if (!r.want.every(function (w) { return Number.isInteger(w) && w >= 0 && w < 5; })) return false;
  if (!Number.isInteger(r.get) || r.get < 0 || r.get > 4) return false;
  if (!Array.isArray(r.after) || r.after.length !== 5) return false;
  return [0, 1, 2, 3, 4].every(function (x) { return r.after.indexOf(x) >= 0; });
}

function push(b) {
  const uid = cleanUid(b.uid);
  if (!uid) return { ok: false, error: "bad_uid" };
  const key = hash(b.key);
  // Si el dispositivo se enlazó a otro código, puede traspasar sus registros antiguos
  // demostrando que conocía la clave anterior.
  const from = cleanUid(b.moveFrom), fromKey = from ? hash(b.moveKey) : "";
  const recs = (Array.isArray(b.records) ? b.records : []).slice(0, MAX_PUSH);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet();
    const last = sh.getLastRow();
    const rows = last > 1 ? sh.getRange(2, 1, last - 1, HEAD.length).getValues() : [];
    const byId = {};
    rows.forEach(function (r, i) { byId[r[0]] = i; });
    const owned = rows.find(function (r) { return r[2] === uid; });
    if (owned && untxt(owned[3]) !== key) return { ok: false, error: "bad_key" };
    const saved = [], add = [];
    let changed = false;
    recs.forEach(function (r) {
      if (!validRecord(r)) return;
      const i = byId[r.id];
      if (i !== undefined) {
        if (rows[i][2] !== uid) {
          if (!from || rows[i][2] !== from || untxt(rows[i][3]) !== fromKey) return;
          sh.getRange(i + 2, 3, 1, 2).setValues([[uid, txt(key)]]);
          rows[i][2] = uid; rows[i][3] = key; changed = true;
        }
        if (r.deleted && !rows[i][10]) { sh.getRange(i + 2, 11).setValue(true); changed = true; }
        saved.push(r.id);
        return;
      }
      if (r.deleted) { saved.push(r.id); return; }
      const cards = r.cards.map(function (c) { return c ? [Number(c.no) || 0, String(c.name || "").slice(0, 30), String(c.r || "").slice(0, 4)] : null; });
      const hit = r.want.indexOf(r.after[r.get]) >= 0;
      add.push([r.id, new Date(Number(r.at) || Date.now()), uid, txt(key), String(r.pack), JSON.stringify(cards), JSON.stringify(r.want), r.get, JSON.stringify(r.after), hit, false]);
      saved.push(r.id);
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, HEAD.length).setValues(add);
    if (add.length || changed) CacheService.getScriptCache().removeAll(cacheKeys());
    return { ok: true, saved: saved };
  } finally {
    lock.releaseLock();
  }
}

function mine(b) {
  const uid = cleanUid(b.uid);
  if (!uid) return { ok: false, error: "bad_uid" };
  const key = hash(b.key);
  const sh = sheet(), last = sh.getLastRow();
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, HEAD.length).getValues() : [];
  return { ok: true, records: rows.filter(function (r) { return r[2] === uid && untxt(r[3]) === key && !r[10]; }).map(toRecord) };
}

function toRecord(r) {
  const cards = JSON.parse(r[5] || "[]").map(function (c) { return c ? { no: c[0], name: untxt(c[1]), r: c[2] } : null; });
  return { id: r[0], at: new Date(r[1]).getTime(), pack: r[4], cards: cards, want: JSON.parse(r[6] || "[]"), get: Number(r[7]), after: JSON.parse(r[8] || "[]") };
}

function cacheKeys() {
  const packs = ["_"];
  const sh = sheet(), last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 5, last - 1, 1).getValues().forEach(function (v) { if (packs.indexOf(v[0]) < 0) packs.push(v[0]); });
  return packs.map(function (p) { return "stats:" + p; });
}

// Misma forma que calcula la página para «Mis registros» (src/domain/stats.ts).
function stats(pack) {
  const cache = CacheService.getScriptCache();
  const ck = "stats:" + (pack || "_");
  const cached = cache.get(ck);
  if (cached) return JSON.parse(cached);
  const sh = sheet(), last = sh.getLastRow();
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, HEAD.length).getValues() : [];
  const z = function () { return [0, 1, 2, 3, 4].map(function () { return [0, 0, 0, 0, 0]; }); };
  const S = { n: 0, hit: 0, expect: 0, getN: [0, 0, 0, 0, 0], getHit: [0, 0, 0, 0, 0], wantAt: [0, 0, 0, 0, 0], wantN: 0,
    moveAll: z(), moveWant: z(), rar: {}, packs: {}, users: 0, updated: Date.now() };
  const users = {};
  rows.forEach(function (row) {
    if (row[10]) return;
    if (pack && row[4] !== pack) return;
    let r;
    try { r = toRecord(row); } catch (e) { return; }
    const A = r.after;
    if (!Array.isArray(A) || A.length !== 5) return;
    users[row[2]] = 1;
    const got = A[r.get], h = r.want.indexOf(got) >= 0;
    S.n++; if (h) S.hit++;
    S.expect += r.want.length / 5;
    S.getN[r.get]++; if (h) S.getHit[r.get]++;
    for (let q = 0; q < 5; q++) { const d = A.indexOf(q); if (d >= 0) S.moveAll[q][d]++; }
    r.want.forEach(function (w) {
      const d = A.indexOf(w); if (d < 0) return;
      S.wantAt[d]++; S.wantN++; S.moveWant[w][d]++;
      const g = RG[(r.cards[w] || {}).r] || "?";
      S.rar[g] = S.rar[g] || [0, 0]; S.rar[g][0]++; if (got === w) S.rar[g][1]++;
    });
    S.packs[r.pack] = S.packs[r.pack] || [0, 0]; S.packs[r.pack][0]++; if (h) S.packs[r.pack][1]++;
  });
  S.users = Object.keys(users).length;
  try { cache.put(ck, JSON.stringify(S), STATS_CACHE_SEC); } catch (e) {}
  return S;
}
