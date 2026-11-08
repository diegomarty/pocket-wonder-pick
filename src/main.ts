/**
 * Wonder Pick log (Elección Milagrosa): the entry of `index.html`.
 *
 * Four views behind a bottom tab bar. Each view owns its markup and re-renders
 * itself from storage; this file only switches between them and keeps the sync
 * ticking in the background.
 */

import "./pocket.css";
import { pullMine, pushPending } from "./infra/sync";
import { h, icon, replace } from "./ui/dom";
import { mountHistory, renderHistory } from "./ui/history-view";
import { mountRecord, render as renderRecord, revealPack } from "./ui/record-view";
import { mountSettings, renderSettings } from "./ui/settings-view";
import { mountStats, renderStats } from "./ui/stats-view";
import { store } from "./infra/storage";
import { lang, t } from "./i18n";

// Loaded fine: drop the cache-busting `?fresh=` the page may have reloaded with (see index.html).
if (new URLSearchParams(location.search).has("fresh")) {
  const url = new URL(location.href);
  url.searchParams.delete("fresh");
  history.replaceState(history.state, "", url);
}

document.documentElement.lang = lang;
document.title = t("docTitle");

type View = "rec" | "hist" | "stats" | "set";

const TABS: { id: View; label: string; icon: Parameters<typeof icon>[0]; render: () => void }[] = [
  { id: "rec", label: t("tabRec"), icon: "cards", render: renderRecord },
  { id: "hist", label: t("tabHist"), icon: "clock", render: renderHistory },
  { id: "stats", label: t("tabStats"), icon: "chart", render: renderStats },
  { id: "set", label: t("tabSet"), icon: "gear", render: renderSettings },
];

const app = document.getElementById("app")!;
const sections = Object.fromEntries(
  TABS.map((t) => [t.id, h("div", { class: "view", id: "view-" + t.id, hidden: true })]),
) as unknown as Record<View, HTMLElement>;

const nav = h(
  "nav",
  { class: "tabbar", "aria-label": t("navLabel") },
  TABS.map((t) =>
    h(
      "button",
      { type: "button", "data-view": t.id, onclick: () => show(t.id) },
      icon(t.icon, 22),
      h("span", null, t.label),
    ),
  ),
);

replace(
  app,
  h(
    "header",
    { class: "appbar" },
    h("div", { class: "logo", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
    h("div", null, h("h1", null, t("appTitle")), h("p", null, t("appSub"))),
  ),
  h("main", null, ...Object.values(sections)),
  nav,
);

let current: View = store.get<View>("view", "rec");

function show(v: View): void {
  current = v;
  store.set("view", v);
  for (const t of TABS) {
    sections[t.id].hidden = t.id !== v;
    nav.querySelector(`[data-view="${t.id}"]`)?.setAttribute("aria-current", t.id === v ? "page" : "false");
  }
  TABS.find((t) => t.id === v)!.render();
  if (v === "rec") revealPack();
  window.scrollTo({ top: 0 });
}

const refreshAll = () => TABS.find((t) => t.id === current)!.render();

mountRecord(sections.rec, () => {});
mountHistory(sections.hist);
mountStats(sections.stats);
mountSettings(sections.set, refreshAll);
show(TABS.some((t) => t.id === current) ? current : "rec");

void (async () => {
  await pushPending();
  if (await pullMine()) refreshAll();
})();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void pushPending();
});
