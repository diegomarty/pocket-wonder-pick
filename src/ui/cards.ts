/**
 * Card faces and backs. A face shows the card's picture when there is one, and the
 * card drawn in CSS when there is none or it does not load (offline, blocked).
 *
 * Pictures are not shipped (all of them would weigh some 40 MB): they load from the
 * community data set pokemon-tcg-pocket-cards on GitHub, pinned to one commit so a
 * file never changes under a URL, and only when a card comes into view.
 */

import { RARITY, TYPES, localName, type CardType, type Rarity } from "../domain/catalog";
import { t } from "../i18n";
import { h, icon } from "./dom";

export interface FaceCard {
  no: number;
  name: string;
  r: Rarity;
  hp?: number;
}

function hash(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
  return x >>> 0;
}

/** A hue per card, near its pack's, so a board of five reads as five different cards. */
export function cardHue(name: string, packHue: number): number {
  return (packHue + (hash(name) % 90) - 45 + 360) % 360;
}

const ART_BASE =
  "https://raw.githubusercontent.com/PocketDecks/pokemon-tcg-pocket-cards/7c654076f51f94ee45e6bbadc73d5834ee79c597/images/webp/cards/";

export function artUrl(path: string): string {
  return ART_BASE + path + ".webp";
}

/** A coloured dot for an energy type. */
export function typeDot(type: CardType): HTMLElement {
  return h("span", { class: "type-dot", style: `--tc:${TYPES[type].color}`, "aria-hidden": "true" });
}

export function rarityTag(r: Rarity): HTMLElement {
  const x = RARITY[r];
  return h("span", { class: "rar rar-" + x.kind, title: x.label }, x.glyph);
}

/**
 * `art` is the card's picture path from `cardArt`; without one, or if it fails to load,
 * the card is drawn in CSS.
 */
export function cardFace(
  c: FaceCard,
  packHue: number,
  opts: { size?: "lg" | "sm"; art?: string | null } = {},
): HTMLElement {
  if (!opts.art) return drawnFace(c, packHue, opts.size);
  const img = h("img", {
    src: artUrl(opts.art),
    alt: localName(c.name, c.r),
    loading: "lazy",
    decoding: "async",
    draggable: "false",
  });
  const el = h("div", { class: `card photo r-${c.r} ${opts.size ?? ""}` }, img);
  img.addEventListener("error", () => el.replaceWith(drawnFace(c, packHue, opts.size)), { once: true });
  return el;
}

function drawnFace(c: FaceCard, packHue: number, size?: "lg" | "sm"): HTMLElement {
  const kind = RARITY[c.r].kind;
  return h(
    "div",
    {
      class: `card face k-${kind} r-${c.r} ${size ?? ""}`,
      style: `--h:${cardHue(c.name, packHue)}`,
    },
    h(
      "div",
      { class: "card-top" },
      h("span", { class: "no" }, c.no ? "#" + String(c.no).padStart(3, "0") : ""),
      c.hp ? h("span", { class: "hp" }, h("small", null, t("hp")), c.hp) : null,
    ),
    h("div", { class: "card-art", "aria-hidden": "true" }, kind === "item" ? icon("clock", 30) : null),
    h("div", { class: "card-name" }, localName(c.name, c.r)),
    h("div", { class: "card-foot" }, rarityTag(c.r)),
  );
}

export function cardBack(): HTMLElement {
  return h("div", { class: "card back", "aria-hidden": "true" }, h("div", { class: "back-mark" }, "?"));
}
