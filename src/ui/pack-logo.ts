/**
 * Pack art: the real booster of each expansion, with its logo printed on it, served from
 * `public/packs/<code>.webp` (see the README for where the images come from).
 *
 * The coloured tile a pack is drawn as stays the fallback: the mixed list and "other
 * pack" have no booster, and a pack added to `packs.json` before its image is simply
 * shown without one. The parent only gets the `has-logo` class once the image has
 * actually loaded, so CSS never lays out room for art that is not there.
 */

import { h } from "./dom";

/** Codes that are ours, not a real set (the mixed list and "other pack"). */
const NO_ART = new Set(["MIX", "X"]);

/** Codes whose image failed once, so a re-render does not ask again. */
const missing = new Set<string>();

export function packLogo(code: string, cls = "pack-logo"): HTMLImageElement | null {
  if (NO_ART.has(code) || missing.has(code)) return null;
  const img = h("img", {
    class: cls,
    src: `${import.meta.env.BASE_URL}packs/${code}.webp`,
    alt: "",
    loading: "lazy",
    decoding: "async",
    draggable: "false",
  });
  const shown = (): void => img.parentElement?.classList.add("has-logo");
  img.addEventListener("load", shown);
  img.addEventListener("error", () => {
    missing.add(code);
    img.parentElement?.classList.remove("has-logo");
    img.remove();
  });
  // Already in the cache: `load` may have fired before the image had a parent.
  queueMicrotask(() => {
    if (img.complete && img.naturalWidth > 0) shown();
  });
  return img;
}
