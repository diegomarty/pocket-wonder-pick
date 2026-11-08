/**
 * Pack logos, loaded at runtime from TCGdex's image server (the same project the card
 * names come from). Nothing is bundled: the browser fetches each logo once and caches it.
 *
 * The coloured block a pack is drawn as stays the fallback. The logo is tried in the page
 * language, then in English; if neither exists (a pack TCGdex does not have yet, or no
 * network) the image removes itself and nothing else changes. The parent only gets the
 * `has-logo` class once an image has actually loaded, so CSS never lays out room for a
 * logo that is not there.
 */

import { lang } from "../i18n";
import { h } from "./dom";

/** Codes that are ours, not a real set (the mixed list and "other pack"). */
const NO_LOGO = new Set(["MIX", "X"]);

const url = (l: string, code: string): string => `https://assets.tcgdex.net/${l}/tcgp/${code}/logo.webp`;

/** Codes known to have no logo in any language, so a re-render does not ask again. */
const missing = new Set<string>();

export function packLogo(code: string, cls = "pack-logo"): HTMLImageElement | null {
  if (NO_LOGO.has(code) || missing.has(code)) return null;
  const tries = lang === "en" ? [url("en", code)] : [url(lang, code), url("en", code)];
  const img = h("img", {
    class: cls,
    src: tries.shift()!,
    alt: "",
    loading: "lazy",
    decoding: "async",
    draggable: "false",
    referrerpolicy: "no-referrer",
  });
  const shown = (): void => img.parentElement?.classList.add("has-logo");
  img.addEventListener("load", shown);
  img.addEventListener("error", () => {
    const next = tries.shift();
    if (next) {
      img.src = next;
      return;
    }
    missing.add(code);
    img.parentElement?.classList.remove("has-logo");
    img.remove();
  });
  // Already in the cache: `load` may have fired before the image was in the document.
  queueMicrotask(() => {
    if (img.complete && img.naturalWidth > 0) shown();
  });
  return img;
}
