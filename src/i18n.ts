/**
 * Two languages, English by default. The choice is read once at load and a change
 * reloads the page: the catalogue builds its names for one language at import time,
 * and a reload is simpler than making every view re-resolve them.
 *
 * Strings may mark bold runs with *asterisks*; `tr` turns those into <b>.
 */

export type Lang = "en" | "es";
export const LANGS: Lang[] = ["en", "es"];

const KEY = "pocketWonderPick:lang";

export const lang: Lang = (() => {
  // `?lang=es` wins, and sticks, so a shared link opens in the sender's language.
  const q = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("lang");
  if (q === "en" || q === "es") {
    try {
      localStorage.setItem(KEY, JSON.stringify(q));
    } catch {
      /* fine: this load still uses it */
    }
    return q;
  }
  try {
    // Outside a browser (the tests) there is no storage; the catch gives the default.
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v === "en" || v === "es") return v;
  } catch {
    /* blocked storage: default */
  }
  return "en";
})();

export function setLang(l: Lang): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    /* nothing to keep it in; still switch for this load */
  }
  const url = new URL(location.href);
  url.searchParams.delete("lang");
  location.replace(url);
}

const en = {
  appTitle: "Wonder Pick",
  appSub: "Log & stats · Pokémon TCG Pocket",
  docTitle: "Wonder Pick Log",
  tabRec: "Log",
  tabHist: "History",
  tabStats: "Stats",
  tabSet: "Settings",
  navLabel: "Sections",

  pos0: "Top left",
  pos1: "Top center",
  pos2: "Top right",
  pos3: "Bottom left",
  pos4: "Bottom right",
  rarItem: "Item",
  item0: "Wonder Hourglass",
  item1: "Pack Hourglass",
  mixPack: "Mixed packs",
  otherPack: "Other pack",

  step1: "Which pack are the cards from?",
  packLabel: "Pack",
  packUnofficial: "Pack name translated by us; it may not match the game yet.",
  step2: "Before the shuffle",
  step2Sub: "The 5 cards in the order they appear. Tap *♥* on the ones you want.",
  add: "Add",
  slotEmpty: "{pos}: empty, tap to add",
  want: "I want it",
  step3: "After the shuffle",
  step3Sub: "Tap each card to say which one landed there, then mark the one you *picked*.",
  afterSlot: "{pos} after the shuffle: {name}",
  notSet: "not set",
  picked: "Picked",
  pick: "Pick",
  predTitle: "Prediction",
  predMine: "My data",
  predAll: "Community",
  predOff: "Off",
  predNoServer: "No community server set up (Settings). Use “My data”.",
  predLoading: "Loading community stats…",
  predNoData: "No history for those positions yet. Log a few picks first.",
  predText: "From past logs, {which} tends to end up in *{pos}*. Based on {n} logs. A blind tap would be *{chance}%*.",
  predOne: "your ♥",
  predMany: "one of your ♥",
  predFew: " Not much data yet: take it with a pinch of salt.",
  posLabel: "Position {n} · {pos}",
  searchPh: "Search by name or number",
  searchPhEmpty: "This pack has no list: type the name below",
  searchLabel: "Search card",
  rarity: "Rarity",
  allRar: "All",
  type: "Type",
  allTypes: "All types",
  untypedHidden: "{n} Pokémon from the newest pack have no type yet, so they only show under All types.",
  more: "{n} more… type a name or use the filters to narrow it down.",
  noMatch: "Nothing by that name. You can type it in below.",
  freeSummary: "Not in the list? Type it in",
  freeName: "Card name",
  clearSlot: "Clear this position",
  afterQ: "Which card landed here after the shuffle?",
  emptyCard: "(empty)",
  nowAt: "now in position {n}",
  packOf: "Pack: {name}",
  pbCards: "Some cards are missing from the before board.",
  pbWant: "Mark at least one card you wanted with ♥.",
  pbAfter: "Say which card landed in each position after the shuffle.",
  pbGet: "Mark the card you picked.",
  gotIt: "Got it!",
  notThisTime: "Not this time.",
  youGot: "You took *{name}*.",
  reset: "Reset",
  resetQ: "Clear what you have entered so far?",
  save: "Save",
  savedHit: "Saved: a hit! 🎉",
  saved: "Saved.",

  histEmptyTitle: "No logs yet",
  histEmptyText: "Every Wonder Pick you log shows up here, and the stats are worked out from them.",
  history: "History",
  histSummary: "{n} logs · {hits} hits ({pct}%)",
  histMeta: "{time} · {pack} · position {n}",
  hit: "Hit",
  miss: "Miss",
  before: "Before the shuffle",
  afterPicked: "After · you picked *{n} ({pos})*",
  deleteLog: "Delete log",
  deleted: "Log deleted.",
  undo: "Undo",
  shotBtn: "Read from a screenshot",
  shotAfterBtn: "Read the result from a screenshot",
  shotBusy: "Reading…",
  shotNone: "No Wonder Pick found: the picture needs the five cards face up, three over two.",
  shotFail: "That picture could not be read.",
  shotRead: "Pack and cards read from the screenshot: check them, then tap ♥.",
  shotPartial: "{n} of 5 read. Tap the rest to fill them in.",
  shotChoose: "Which Wonder Pick?",
  shotAfterRead: "Where each card landed, read from the screenshot.",
  shotAfterNone: "Those are not the five cards above.",
  seeMore: "Show more",

  stats: "Stats",
  myLogs: "My logs",
  community: "Community",
  needServer: "Set up a server in Settings",
  needServerHint: "Community stats need a server; set one up in Settings.",
  allPacks: "All packs",
  loadingCommunity: "Loading community stats…",
  noConnect: "Could not reach the server.",
  noDataMine: "No data yet",
  noDataAll: "The community has no data yet",
  noDataText: "Log a few Wonder Picks and you will see which positions work best for you.",
  kLogs: "Logs",
  kPlayers: "{n} players",
  kYours: "yours",
  kHits: "Hits",
  kOf: "{a} of {b}",
  kChance: "By chance",
  kExpected: "expected",
  kLuck: "Luck",
  kAbove: "above",
  kBelow: "below",
  pts: "pts",
  whereHit: "Where do you hit most?",
  whereHitSub: "Hit rate by the position you tapped.",
  whereGo: "Where does a card go in the shuffle?",
  chooseFrom: "Pick a position before the shuffle:",
  cardIn: "A card in *{n} · {pos}* ended up in:",
  times: "{n} times",
  uniform: "If the shuffle were perfectly random, each position would sit around 20%. ",
  fewData: "Not enough data to draw conclusions yet.",
  skewed: "*This spread strays from chance (χ² = {chi}); there may be a pattern.*",
  fair: "So far, consistent with chance (χ² = {chi}).",
  wantEnd: "♥ Where did the ones you wanted end up?",
  byRarity: "By rarity of the ♥",
  picks: "picked",
  byPack: "By pack",
  logsLower: "logs",
  noDataShort: "No data.",
  communityWarn: "Data sent by the community may contain mistakes. Treat it as a guide.",

  language: "Language",
  server: "Community server",
  serverText:
    "Optional. With a server, your logs add up with everyone else's and you can see everyone's stats. Without one, everything stays on this device. How to set one up: ",
  serverUrl: "Web app URL (Apps Script)",
  mustBeGoogle: "It has to be a script.google.com URL.",
  checking: "Checking…",
  badServer: "It did not answer as expected. Check the URL and that it is deployed for “Anyone”.",
  connected: "Connected.",
  removed: "Server removed: everything stays on this device.",
  pending: "{n} logs waiting to be sent.",
  allSent: "Everything sent.",
  otherDevice: "Use on another device",
  otherDeviceText:
    "Your logs on the server are identified by this code, created at random on this device (we never ask for a game ID or social handle). Paste it on another device to share the same logs. Keep it private: whoever has it can add logs as you.",
  linkCode: "Your link code",
  copy: "Copy",
  copied: "Code copied.",
  pasteCode: "Paste the code from another device",
  link: "Link",
  badCode: "That code is not valid.",
  linked: "Linked. Downloading your logs…",
  backup: "Backup",
  onDevice: "{n} logs on this device.",
  export: "Export",
  import: "Import",
  imported: "Imported {n} logs.",
  nothingNew: "No new logs in that file.",
  badFile: "That file is not a valid backup.",
  deleteAll: "Delete everything",
  deleteAllQ: "Delete all logs on this device? Those already sent to the server will be marked as deleted.",
  about: "About",
  aboutText:
    "Unofficial fan tool, not affiliated with The Pokémon Company, Creatures, DeNA or Nintendo. Inspired by the ゲットチャレンジ log by card-request-box. Card names: TCGdex and PokeAPI; some recent pack and trainer names are our own translations.",
  close: "Close",
  hp: "HP",
};

type Dict = Record<keyof typeof en, string>;

const es: Dict = {
  appTitle: "Elección Milagrosa",
  appSub: "Registro y estadísticas · JCC Pokémon Pocket",
  docTitle: "Registro de Elección Milagrosa",
  tabRec: "Registrar",
  tabHist: "Historial",
  tabStats: "Estadísticas",
  tabSet: "Ajustes",
  navLabel: "Secciones",

  pos0: "Arriba izq.",
  pos1: "Arriba centro",
  pos2: "Arriba der.",
  pos3: "Abajo izq.",
  pos4: "Abajo der.",
  rarItem: "Objeto",
  item0: "Reloj de arena de Elección",
  item1: "Reloj de arena de sobres",
  mixPack: "Varios sobres",
  otherPack: "Otro sobre",

  step1: "¿De qué sobre son las cartas?",
  packLabel: "Sobre",
  packUnofficial: "Nombre del sobre traducido por nosotros; puede no coincidir con el del juego.",
  step2: "Antes de barajar",
  step2Sub: "Las 5 cartas en el orden en que aparecen. Toca *♥* en las que quieras.",
  add: "Añadir",
  slotEmpty: "{pos}: vacía, toca para añadir",
  want: "La quiero",
  step3: "Después de barajar",
  step3Sub: "Toca cada carta para indicar cuál quedó ahí y marca la que *elegiste*.",
  afterSlot: "{pos} después de barajar: {name}",
  notSet: "sin indicar",
  picked: "Elegida",
  pick: "Elegir",
  predTitle: "Predicción",
  predMine: "Mis datos",
  predAll: "Comunidad",
  predOff: "Off",
  predNoServer: "No hay servidor de comunidad configurado (Ajustes). Usa «Mis datos».",
  predLoading: "Cargando estadísticas de la comunidad…",
  predNoData: "Aún no hay datos de esas posiciones. Registra unas cuantas elecciones.",
  predText:
    "Según registros anteriores, {which} suele acabar en *{pos}*. Basado en {n} registros. Al azar sería un *{chance}%*.",
  predOne: "tu ♥",
  predMany: "alguna de tus ♥",
  predFew: " Pocos datos: tómalo con cautela.",
  posLabel: "Posición {n} · {pos}",
  searchPh: "Busca por nombre o número",
  searchPhEmpty: "Este sobre no tiene lista: escribe el nombre abajo",
  searchLabel: "Buscar carta",
  rarity: "Rareza",
  allRar: "Todas",
  type: "Tipo",
  allTypes: "Todos los tipos",
  untypedHidden: "{n} Pokémon del sobre más nuevo aún no tienen tipo, así que solo salen en Todos los tipos.",
  more: "{n} más… escribe un nombre o usa los filtros para afinar.",
  noMatch: "Nada con ese nombre. Puedes escribirla a mano abajo.",
  freeSummary: "¿No está en la lista? Escríbela",
  freeName: "Nombre de la carta",
  clearSlot: "Vaciar esta posición",
  afterQ: "¿Qué carta quedó aquí después de barajar?",
  emptyCard: "(vacía)",
  nowAt: "ahora en la posición {n}",
  packOf: "Sobre: {name}",
  pbCards: "Faltan cartas en el tablero de antes de barajar.",
  pbWant: "Marca con ♥ al menos una carta que quisieras.",
  pbAfter: "Indica qué carta quedó en cada posición después de barajar.",
  pbGet: "Marca la carta que elegiste.",
  gotIt: "¡Conseguida!",
  notThisTime: "Esta vez no.",
  youGot: "Te llevaste *{name}*.",
  reset: "Reiniciar",
  resetQ: "¿Borrar lo que llevas introducido?",
  save: "Guardar",
  savedHit: "Guardado: ¡acierto! 🎉",
  saved: "Guardado.",

  histEmptyTitle: "Aún no hay registros",
  histEmptyText: "Cada Elección que registres aparecerá aquí, y con ellas se calculan las estadísticas.",
  history: "Historial",
  histSummary: "{n} registros · {hits} aciertos ({pct}%)",
  histMeta: "{time} · {pack} · posición {n}",
  hit: "Acierto",
  miss: "Fallo",
  before: "Antes de barajar",
  afterPicked: "Después · elegiste la *{n} ({pos})*",
  deleteLog: "Borrar registro",
  deleted: "Registro borrado.",
  undo: "Deshacer",
  shotBtn: "Leer desde una captura",
  shotAfterBtn: "Leer el resultado desde una captura",
  shotBusy: "Leyendo…",
  shotNone:
    "No encuentro ninguna Elección mágica: la imagen debe mostrar las cinco cartas boca arriba, tres arriba y dos abajo.",
  shotFail: "No se ha podido leer esa imagen.",
  shotRead: "Sobre y cartas leídos de la captura: revísalos y toca ♥.",
  shotPartial: "{n} de 5 leídas. Toca las que faltan para añadirlas.",
  shotChoose: "¿Qué Elección mágica?",
  shotAfterRead: "Dónde quedó cada carta, leído de la captura.",
  shotAfterNone: "Esas no son las cinco cartas de arriba.",
  seeMore: "Ver más",

  stats: "Estadísticas",
  myLogs: "Mis registros",
  community: "Comunidad",
  needServer: "Configura un servidor en Ajustes",
  needServerHint: "Las estadísticas de la comunidad necesitan un servidor; se configura en Ajustes.",
  allPacks: "Todos los sobres",
  loadingCommunity: "Cargando estadísticas de la comunidad…",
  noConnect: "No se pudo conectar con el servidor.",
  noDataMine: "Sin datos todavía",
  noDataAll: "La comunidad aún no tiene datos",
  noDataText: "Registra unas cuantas Elecciones y aquí verás qué posiciones te funcionan mejor.",
  kLogs: "Registros",
  kPlayers: "{n} jugadores",
  kYours: "tuyos",
  kHits: "Aciertos",
  kOf: "{a} de {b}",
  kChance: "Por azar",
  kExpected: "lo esperable",
  kLuck: "Suerte",
  kAbove: "por encima",
  kBelow: "por debajo",
  pts: "pts",
  whereHit: "¿Dónde aciertas más al elegir?",
  whereHitSub: "Porcentaje de acierto según la posición que tocaste.",
  whereGo: "¿A dónde va una carta al barajar?",
  chooseFrom: "Elige una posición de antes de barajar:",
  cardIn: "Una carta en la *{n} · {pos}* acabó en:",
  times: "{n} veces",
  uniform: "Si el barajado fuera perfectamente aleatorio, cada posición rondaría el 20%. ",
  fewData: "Aún hay pocos datos para sacar conclusiones.",
  skewed: "*Este reparto se aleja del azar (χ² = {chi}), quizá haya un patrón.*",
  fair: "Por ahora, compatible con el azar (χ² = {chi}).",
  wantEnd: "♥ ¿Dónde acabaron las que querías?",
  byRarity: "Por rareza de la ♥",
  picks: "elegidas",
  byPack: "Por sobre",
  logsLower: "registros",
  noDataShort: "Sin datos.",
  communityWarn: "Datos enviados por la comunidad: puede haber registros erróneos. Úsalos como referencia.",

  language: "Idioma",
  server: "Servidor de la comunidad",
  serverText:
    "Opcional. Con un servidor, tus registros se suman a los de los demás y se ven las estadísticas de todos. Sin él, todo se queda en este dispositivo. Cómo crear uno: ",
  serverUrl: "URL de la aplicación web (Apps Script)",
  mustBeGoogle: "Tiene que ser una URL de script.google.com.",
  checking: "Comprobando…",
  badServer: "No responde como esperábamos. Revisa la URL y que esté publicada para «Cualquier usuario».",
  connected: "Conectado.",
  removed: "Servidor quitado: todo queda en este dispositivo.",
  pending: "{n} registros pendientes de enviar.",
  allSent: "Todo enviado.",
  otherDevice: "Usar en otro dispositivo",
  otherDeviceText:
    "Tus registros en el servidor se identifican con este código, creado al azar en este dispositivo (no pedimos ID de juego ni redes). Pégalo en otro dispositivo para que sean los mismos registros. No lo compartas: quien lo tenga puede añadir registros en tu nombre.",
  linkCode: "Tu código de enlace",
  copy: "Copiar",
  copied: "Código copiado.",
  pasteCode: "Pegar el código de otro dispositivo",
  link: "Enlazar",
  badCode: "Ese código no es válido.",
  linked: "Enlazado. Descargando tus registros…",
  backup: "Copia de seguridad",
  onDevice: "{n} registros en este dispositivo.",
  export: "Exportar",
  import: "Importar",
  imported: "Importados {n} registros.",
  nothingNew: "No había registros nuevos.",
  badFile: "Ese archivo no es una copia válida.",
  deleteAll: "Borrar todo",
  deleteAllQ: "¿Borrar todos los registros de este dispositivo? Los ya enviados al servidor se marcarán como borrados.",
  about: "Acerca de",
  aboutText:
    "Herramienta de fans, no oficial, sin relación con The Pokémon Company, Creatures, DeNA ni Nintendo. Inspirada en el registro de ゲットチャレンジ de card-request-box. Nombres de cartas: TCGdex y PokeAPI; algunos nombres de sobres y entrenadores recientes son traducciones propias.",
  close: "Cerrar",
  hp: "PS",
};

export type MsgKey = keyof typeof en;
const DICTS: Record<Lang, Dict> = { en, es };

export function t(key: MsgKey, vars: Record<string, string | number> = {}): string {
  return DICTS[lang][key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

/** `t`, with *starred* runs turned into <b>. */
export function tr(key: MsgKey, vars: Record<string, string | number> = {}): (string | HTMLElement)[] {
  return t(key, vars)
    .split(/\*([^*]+)\*/)
    .map((part, i) => {
      if (i % 2 === 0) return part;
      const b = document.createElement("b");
      b.textContent = part;
      return b;
    })
    .filter((p) => p !== "");
}

export const LANG_NAMES: Record<Lang, string> = { en: "English", es: "Español" };
