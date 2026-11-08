/**
 * The card catalogue for Wonder Pick, in English and Spanish.
 *
 * `packs.json` comes from the Japanese list the original tool keeps (set code, card
 * number, rarity, HP — the authoritative part), with names from TCGdex where it has
 * them, PokeAPI's species names for Pokémon it does not, and a hand-written
 * dictionary for trainers and items. Wonder Pick never offers ☆3, shinies or
 * crowns, so those are already left out of the file.
 *
 * Names are resolved for the page language once, at import.
 */

import raw from "../data/packs.json";
import { lang, t } from "../i18n";

export type Rarity = "d1" | "d2" | "d3" | "d4" | "s1" | "s2" | "item";

export interface Card {
  no: number;
  name: string;
  /** The name in the other language, so search finds either. */
  alt?: string;
  r: Rarity;
  hp?: number;
  /** Only on cards of the mixed list, to say which pack they come from. */
  from?: string;
}

export interface Pack {
  code: string;
  name: string;
  /** False when the name is our translation and not the in-game one yet. */
  official: boolean;
  hue: number;
  cards: Card[];
}

type L = { en: string; es: string };
type RawPack = {
  code: string;
  name: L;
  official: { en: boolean; es: boolean };
  hue: number;
  cards: [number, string, string, string, number][];
};

export const RARITY: Record<Rarity, { label: string; glyph: string; kind: "diamond" | "star" | "item" }> = {
  d1: { label: "◆", glyph: "◆", kind: "diamond" },
  d2: { label: "◆◆", glyph: "◆◆", kind: "diamond" },
  d3: { label: "◆◆◆", glyph: "◆◆◆", kind: "diamond" },
  d4: { label: "◆◆◆◆", glyph: "◆◆◆◆", kind: "diamond" },
  s1: { label: "★", glyph: "★", kind: "star" },
  s2: { label: "★★", glyph: "★★", kind: "star" },
  item: { label: t("rarItem"), glyph: "⧗", kind: "item" },
};

export const RARITY_ORDER: Rarity[] = ["d1", "d2", "d3", "d4", "s1", "s2", "item"];

/**
 * Rarities grouped the way the stats count them (◆1 and ◆2 are the same filler).
 * The keys travel to the server, so they are language-neutral; `rarityGroupLabel` names them.
 */
export const RARITY_GROUP: Record<Rarity, string> = {
  d1: "◆1–2",
  d2: "◆1–2",
  d3: "◆3",
  d4: "◆4",
  s1: "★1",
  s2: "★2",
  item: "item",
};
export const RARITY_GROUPS = ["◆1–2", "◆3", "◆4", "★1", "★2", "item"];
export const rarityGroupLabel = (g: string) => (g === "item" ? t("rarItem") : g);

const ITEM_NAMES: L[] = [
  { en: "Wonder Hourglass", es: "Reloj de arena de Elección" },
  { en: "Pack Hourglass", es: "Reloj de arena de sobres" },
];
const other = lang === "en" ? "es" : "en";

/** What a free Wonder Pick can hand out instead of a card. */
export const ITEMS: Card[] = ITEM_NAMES.map((n) => ({ no: 0, name: n[lang], alt: n[other], r: "item" }));

/** The five slots, in the order the game lays them out: three on top, two below. */
export const POSITIONS = [t("pos0"), t("pos1"), t("pos2"), t("pos3"), t("pos4")];

const isRarity = (r: string): r is Rarity => r in RARITY;

export const PACKS: Pack[] = (raw as RawPack[]).map((p) => ({
  code: p.code,
  name: p.name[lang],
  official: p.official[lang],
  hue: p.hue,
  cards: p.cards
    .filter((c) => isRarity(c[3]))
    .map(([no, en, es, r, hp]) => {
      const n: L = { en, es };
      return {
        no,
        name: n[lang],
        ...(n[other] !== n[lang] ? { alt: n[other] } : {}),
        r: r as Rarity,
        ...(hp ? { hp } : {}),
      };
    }),
}));

/** Lucky picks and similar mix cards from every pack: one entry per name and rarity. */
export const MIX: Pack = (() => {
  const seen = new Set<string>();
  const cards: Card[] = [];
  for (const p of PACKS) {
    for (const c of p.cards) {
      const k = c.name + "|" + c.r;
      if (seen.has(k)) continue;
      seen.add(k);
      cards.push({ ...c, from: p.name });
    }
  }
  return { code: "MIX", name: t("mixPack"), official: true, hue: 210, cards };
})();

/** A pack the list does not know yet: cards are typed in by hand. */
export const OTHER: Pack = { code: "X", name: t("otherPack"), official: true, hue: 0, cards: [] };

export function packByCode(code: string): Pack | undefined {
  if (code === MIX.code) return MIX;
  if (code === OTHER.code) return OTHER;
  return PACKS.find((p) => p.code === code);
}

/**
 * A saved card's name in the page language. Records keep the name they were saved
 * with, so a log made in Spanish still reads in English after switching.
 */
const LOCAL = (() => {
  const m = new Map<string, string>();
  for (const c of [...MIX.cards, ...ITEMS]) {
    m.set(c.name + "|" + c.r, c.name);
    if (c.alt) m.set(c.alt + "|" + c.r, c.name);
  }
  return m;
})();
export function localName(name: string, r: Rarity): string {
  return LOCAL.get(name + "|" + r) ?? name;
}

/** Lower-case, no accents, no punctuation: what the search box compares. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9♀♂]+/g, " ")
    .trim();
}

export function searchCards(cards: Card[], query: string, rarity: Rarity | "" = ""): Card[] {
  const q = fold(query);
  const num = /^\d+$/.test(q) ? Number(q) : null;
  return cards.filter((c) => {
    if (rarity && c.r !== rarity) return false;
    if (!q) return true;
    if (num !== null && c.no === num) return true;
    return fold(c.name).includes(q) || (!!c.alt && fold(c.alt).includes(q));
  });
}
