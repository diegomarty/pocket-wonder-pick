/** Card faces and backs, drawn in CSS: no card art is shipped or hot-linked. */

import { RARITY, localName, type Rarity } from "../domain/catalog";
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

export function rarityTag(r: Rarity): HTMLElement {
  const x = RARITY[r];
  return h("span", { class: "rar rar-" + x.kind, title: x.label }, x.glyph);
}

export function cardFace(c: FaceCard, packHue: number, opts: { size?: "lg" | "sm" } = {}): HTMLElement {
  const kind = RARITY[c.r].kind;
  return h(
    "div",
    {
      class: `card face k-${kind} r-${c.r} ${opts.size ?? ""}`,
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
