/** History: every saved pick, newest first, with undoable delete. */

import { POSITIONS, localName, packByCode } from "../domain/catalog";
import { lang, t, tr } from "../i18n";
import { isHit, type PickRecord } from "../domain/record";
import { loadRecords, saveRecords } from "../infra/storage";
import { pushPending } from "../infra/sync";
import { cardFace } from "./cards";
import { h, icon, replace } from "./dom";
import { toast } from "./sheet";
import { packLogo } from "./pack-logo";

let root: HTMLElement;
let shown = 30;
const open = new Set<string>();

export function mountHistory(el: HTMLElement): void {
  root = el;
}

const dayFmt = new Intl.DateTimeFormat(lang, { weekday: "long", day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" });

export function renderHistory(): void {
  if (!root) return;
  const list = loadRecords().filter((r) => !r.deleted);
  if (!list.length) {
    replace(
      root,
      h(
        "section",
        { class: "panel empty-state" },
        h("div", { class: "empty-cards", "aria-hidden": "true" }, h("span"), h("span"), h("span")),
        h("h2", null, t("histEmptyTitle")),
        h("p", null, t("histEmptyText")),
      ),
    );
    return;
  }
  const hits = list.filter(isHit).length;
  const groups = new Map<string, PickRecord[]>();
  for (const r of list.slice(0, shown)) {
    const k = dayFmt.format(r.at);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  replace(
    root,
    h(
      "section",
      { class: "panel hist-head" },
      h("h2", null, t("history")),
      h("p", { class: "sub" }, t("histSummary", { n: list.length, hits, pct: Math.round((hits / list.length) * 100) })),
    ),
    ...[...groups].map(([day, recs]) =>
      h("section", { class: "hist-day" }, h("h3", null, day), h("ul", { class: "hist" }, recs.map(item))),
    ),
    list.length > shown
      ? h(
          "button",
          {
            type: "button",
            class: "btn ghost",
            onclick: () => {
              shown += 30;
              renderHistory();
            },
          },
          t("seeMore"),
        )
      : null,
  );
}

function item(r: PickRecord): HTMLElement {
  const p = packByCode(r.pack);
  const hue = p?.hue ?? 210;
  const hit = isHit(r);
  const got = r.cards[r.after[r.get]!];
  const expanded = open.has(r.id);
  return h(
    "li",
    { class: "hist-item" + (hit ? " hit" : "") + (expanded ? " open" : ""), style: `--h:${hue}` },
    h(
      "button",
      {
        type: "button",
        class: "hist-row",
        "aria-expanded": expanded ? "true" : "false",
        onclick: () => {
          if (expanded) open.delete(r.id);
          else open.add(r.id);
          renderHistory();
        },
      },
      h(
        "span",
        { class: "hist-pack" },
        h("span", { class: "hist-code" }, r.pack === "MIX" ? "∞" : r.pack === "X" ? "?" : r.pack),
        packLogo(r.pack),
      ),
      h(
        "span",
        { class: "hist-main" },
        h("b", null, got ? localName(got.name, got.r) : "?"),
        h("small", null, t("histMeta", { time: timeFmt.format(r.at), pack: p?.name ?? r.pack, n: r.get + 1 })),
      ),
      h(
        "span",
        { class: "dots", "aria-hidden": "true" },
        [0, 1, 2, 3, 4].map((j) => {
          const from = r.after[j]!;
          return h("i", {
            class: (r.want.includes(from) ? "w" : "") + (j === r.get ? " g" : ""),
          });
        }),
      ),
      h("span", { class: "badge" + (hit ? " hit" : "") }, hit ? t("hit") : t("miss")),
    ),
    expanded ? detail(r, hue) : null,
  );
}

function detail(r: PickRecord, hue: number): HTMLElement {
  const mini = (cards: (PickRecord["cards"][number] | undefined)[], mark: (i: number) => string) =>
    h(
      "div",
      { class: "board mini" },
      [0, 1].map((row) =>
        h(
          "div",
          { class: "row" },
          (row ? [3, 4] : [0, 1, 2]).map((i) => {
            const c = cards[i];
            return h(
              "div",
              { class: "slot " + mark(i) },
              c ? cardFace(c, hue, { size: "sm" }) : h("div", { class: "card empty" }),
            );
          }),
        ),
      ),
    );
  return h(
    "div",
    { class: "hist-detail" },
    h("p", { class: "flow-label" }, t("before")),
    mini(r.cards, (i) => (r.want.includes(i) ? "wanted" : "")),
    h("p", { class: "flow-label" }, tr("afterPicked", { n: r.get + 1, pos: POSITIONS[r.get]! })),
    mini(
      r.after.map((i) => r.cards[i]),
      (j) => (r.want.includes(r.after[j]!) ? "wanted" : "") + (j === r.get ? " chosen" : ""),
    ),
    h(
      "button",
      { type: "button", class: "btn ghost small danger", onclick: () => remove(r) },
      icon("trash", 16),
      t("deleteLog"),
    ),
  );
}

function remove(r: PickRecord): void {
  const before = loadRecords();
  saveRecords(before.map((x) => (x.id === r.id ? { ...x, deleted: true } : x)));
  renderHistory();
  toast(t("deleted"), {
    action: {
      label: t("undo"),
      run: () => {
        saveRecords(loadRecords().map((x) => (x.id === r.id ? { ...x, deleted: false, delSynced: false } : x)));
        renderHistory();
      },
    },
  });
  setTimeout(() => void pushPending(), 6500);
}
