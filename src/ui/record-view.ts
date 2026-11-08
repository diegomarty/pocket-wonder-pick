/** Log: the two boards, before and after the shuffle, and the save button. */

import {
  ITEMS,
  MIX,
  OTHER,
  PACKS,
  POSITIONS,
  RARITY,
  RARITY_ORDER,
  TYPES,
  TYPE_ORDER,
  cardArt,
  localName,
  packByCode,
  searchCards,
  type Card,
  type CardType,
  type Pack,
  type Rarity,
} from "../domain/catalog";
import { autoComplete, draftProblem, isHit, newDraft, toRecord, type Draft, type DraftProblem } from "../domain/record";
import { t, tr } from "../i18n";
import { aggregate, predict } from "../domain/stats";
import { loadRecords, saveRecords, store } from "../infra/storage";
import { cachedCommunityStats, communityStats, pushPending, serverUrl } from "../infra/sync";
import { cardBack, cardFace, rarityTag, typeDot } from "./cards";
import { h, icon, replace } from "./dom";
import { closeSheet, openSheet, toast } from "./sheet";
import { packLogo } from "./pack-logo";

const ALL_PACKS: Pack[] = [...PACKS, MIX, OTHER];

let draft: Draft = (() => {
  const d = store.get<Draft | null>("draft", null);
  if (d && packByCode(d.pack) && Array.isArray(d.cards) && d.cards.length === 5)
    return { ...d, cards: d.cards.map((c) => (c ? { ...c, name: localName(c.name, c.r) } : null)) };
  return newDraft(store.get("lastPack", PACKS[0]!.code));
})();

const ai = store.get("ai", { on: true, who: "me" as "me" | "all" });
let root: HTMLElement;
let onSaved: () => void = () => {};

function persist(): void {
  store.set("draft", draft);
}

function update(): void {
  persist();
  render();
}

const pack = (): Pack => packByCode(draft.pack) ?? PACKS[0]!;

export function mountRecord(el: HTMLElement, saved: () => void): void {
  root = el;
  onSaved = saved;
  render();
  revealPack("auto");
}

/** Brings the selected pack into view in the rail, which is longer than any screen. */
export function revealPack(behavior: ScrollBehavior = "auto"): void {
  requestAnimationFrame(() => {
    const chip = root.querySelector<HTMLElement>(".pack-chip.on");
    const rail = chip?.parentElement;
    if (!chip || !rail) return;
    const delta = chip.getBoundingClientRect().left - rail.getBoundingClientRect().left;
    rail.scrollTo({ left: rail.scrollLeft + delta - rail.clientWidth / 2 + chip.clientWidth / 2, behavior });
  });
}

export function render(): void {
  if (!root) return;
  // The whole view is rebuilt on every change; keep the pack rail where the user left it.
  const scroll = root.querySelector(".pack-rail")?.scrollLeft ?? 0;
  replace(root, packPicker(), beforeSection(), afterSection(), resultBar());
  const rail = root.querySelector(".pack-rail");
  if (rail) rail.scrollLeft = scroll;
}

/* ---------- pack ---------- */

function packPicker(): HTMLElement {
  const p = pack();
  return h(
    "section",
    { class: "panel pack-panel" },
    h("div", { class: "step-head" }, h("span", { class: "step" }, "1"), h("h2", null, t("step1"))),
    h(
      "div",
      { class: "pack-rail", role: "radiogroup", "aria-label": t("packLabel") },
      ALL_PACKS.map((pk) =>
        h(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": pk.code === p.code ? "true" : "false",
            class: "pack-chip" + (pk.code === p.code ? " on" : "") + (pk.code.length > 3 ? " special" : ""),
            style: `--h:${pk.hue}`,
            title: pk.name,
            onclick: () => choosePack(pk.code),
          },
          h("span", { class: "pack-code" }, pk.code === "MIX" ? "∞" : pk.code === "X" ? "?" : pk.code),
          packLogo(pk.code),
          h("span", { class: "pack-name" }, pk.name),
        ),
      ),
    ),
    h("p", { class: "pack-current" }, t("packOf", { name: p.name })),
    !p.official ? h("p", { class: "hint" }, t("packUnofficial")) : null,
  );
}

function choosePack(code: string): void {
  if (code === draft.pack) return;
  const hasCards = draft.cards.some(Boolean);
  draft = hasCards ? { ...draft, pack: code } : newDraft(code);
  store.set("lastPack", code);
  update();
  requestAnimationFrame(() =>
    root.querySelector(".pack-chip.on")?.scrollIntoView({ inline: "center", block: "nearest" }),
  );
}

/* ---------- before ---------- */

function board(slots: HTMLElement[]): HTMLElement {
  return h(
    "div",
    { class: "board" },
    h("div", { class: "row" }, slots.slice(0, 3)),
    h("div", { class: "row" }, slots.slice(3)),
  );
}

function beforeSection(): HTMLElement {
  const p = pack();
  const slots = [0, 1, 2, 3, 4].map((i) => {
    const c = draft.cards[i];
    const wanted = draft.want.includes(i);
    return h(
      "div",
      { class: "slot" + (wanted ? " wanted" : "") },
      h(
        "button",
        {
          type: "button",
          class: "slot-btn",
          "aria-label": c ? `${POSITIONS[i]}: ${c.name}` : t("slotEmpty", { pos: POSITIONS[i]! }),
          onclick: () => openPicker(i),
        },
        c
          ? cardFace(c, p.hue, { art: cardArt(p.code, c) })
          : h("div", { class: "card empty" }, icon("plus", 26), h("span", null, t("add"))),
      ),
      h(
        "button",
        {
          type: "button",
          class: "pick-mark heart-mark" + (wanted ? " on" : ""),
          disabled: !c,
          "aria-pressed": wanted ? "true" : "false",
          onclick: () => toggleWant(i),
        },
        icon("heart", 15),
        t("want"),
      ),
      h("span", { class: "pos" }, i + 1),
    );
  });
  return h(
    "section",
    { class: "panel" },
    h("div", { class: "step-head" }, h("span", { class: "step" }, "2"), h("h2", null, t("step2"))),
    h("p", { class: "sub" }, tr("step2Sub")),
    board(slots),
  );
}

function toggleWant(i: number): void {
  draft.want = draft.want.includes(i) ? draft.want.filter((x) => x !== i) : [...draft.want, i].sort();
  update();
}

let pickRarity: Rarity | "" = "";
let pickType: CardType | "" = "";

/** A row of filter chips that scrolls sideways, so it never takes more than one line. */
function chipRow<T extends string>(
  label: string,
  options: { value: T | ""; text: string; dot?: CardType }[],
  current: () => T | "",
  set: (v: T | "") => void,
): HTMLElement {
  const row = h("div", { class: "chips", role: "group", "aria-label": label });
  const draw = () =>
    replace(
      row,
      ...options.map((o) =>
        h(
          "button",
          {
            type: "button",
            class: "chip" + (current() === o.value ? " on" : ""),
            "aria-pressed": current() === o.value ? "true" : "false",
            onclick: () => {
              set(o.value);
              draw();
            },
          },
          o.dot ? typeDot(o.dot) : null,
          o.text,
        ),
      ),
    );
  draw();
  return row;
}

function openPicker(slot: number): void {
  const p = pack();
  const pool = [...p.cards, ...ITEMS];
  const grid = h("ul", { class: "pick-grid" });
  const q = h("input", {
    type: "search",
    placeholder: p.cards.length ? t("searchPh") : t("searchPhEmpty"),
    autocomplete: "off",
    enterkeyhint: "search",
    "aria-label": t("searchLabel"),
  });

  const choose = (c: Card) => {
    draft.cards[slot] = { no: c.no, name: c.name, r: c.r, ...(c.hp ? { hp: c.hp } : {}) };
    closeSheet();
    update();
    const next = draft.cards.findIndex((x, k) => !x && k > slot);
    if (next >= 0) setTimeout(() => openPicker(next), 220);
  };

  // Only what this pack has: a filter for anything else would only ever show an empty list.
  const rarityList = RARITY_ORDER.filter((r) => pool.some((c) => c.r === r));
  if (pickRarity && !rarityList.includes(pickRarity)) pickRarity = "";
  const types = TYPE_ORDER.filter((ty) => p.cards.some((c) => c.type === ty));
  if (pickType && !types.includes(pickType)) pickType = "";
  const untyped = p.cards.filter((c) => !c.type).length;

  const fill = () => {
    const found = searchCards(pool, q.value, pickRarity, pickType);
    const shown = found.slice(0, 120);
    grid.scrollTop = 0;
    replace(
      grid,
      ...shown.map((c) => {
        const art = c.from ? cardArt("MIX", c) : cardArt(p.code, c);
        return h(
          "li",
          null,
          h(
            "button",
            {
              type: "button",
              class: "pick-card" + (art ? "" : " drawn"),
              "aria-label": `${c.no ? "#" + c.no + " " : ""}${c.name} ${RARITY[c.r].label}`,
              onclick: () => choose(c),
            },
            cardFace(c, p.hue, { size: art ? undefined : "sm", art }),
            h(
              "span",
              { class: "pick-cap" },
              c.type ? typeDot(c.type) : null,
              h("span", { class: "pick-cap-name" }, c.name),
              rarityTag(c.r),
            ),
            c.from ? h("small", { class: "pick-from" }, c.from) : null,
          ),
        );
      }),
      found.length > shown.length ? h("li", { class: "more" }, t("more", { n: found.length - shown.length })) : null,
      !found.length ? h("li", { class: "more" }, t("noMatch")) : null,
      pickType && untyped ? h("li", { class: "more" }, t("untypedHidden", { n: untyped })) : null,
    );
  };
  q.addEventListener("input", fill);

  const rarities = chipRow<Rarity>(
    t("rarity"),
    [{ value: "", text: t("allRar") }, ...rarityList.map((r) => ({ value: r, text: RARITY[r].label }))],
    () => pickRarity,
    (v) => {
      pickRarity = v;
      fill();
    },
  );
  const typeRow =
    types.length > 1
      ? chipRow<CardType>(
          t("type"),
          [{ value: "", text: t("allTypes") }, ...types.map((ty) => ({ value: ty, text: TYPES[ty].name, dot: ty }))],
          () => pickType,
          (v) => {
            pickType = v;
            fill();
          },
        )
      : null;
  fill();

  const freeName = h("input", { placeholder: t("freeName"), maxlength: "30", autocomplete: "off" });
  const freeRar = h(
    "select",
    { "aria-label": t("rarity") },
    RARITY_ORDER.map((r) => h("option", { value: r }, RARITY[r].label)),
  );
  const free = h(
    "details",
    { class: "free", open: !p.cards.length },
    h("summary", null, t("freeSummary")),
    h(
      "div",
      { class: "free-row" },
      freeName,
      freeRar,
      h(
        "button",
        {
          type: "button",
          class: "btn small",
          onclick: () => {
            const name = freeName.value.trim().slice(0, 30);
            if (!name) return freeName.focus();
            choose({ no: 0, name, r: freeRar.value as Rarity });
          },
        },
        t("add"),
      ),
    ),
  );

  openSheet(t("posLabel", { n: slot + 1, pos: POSITIONS[slot]! }), `${p.code} · ${p.name}`, [
    h("div", { class: "pick-tools" }, h("label", { class: "search" }, icon("search", 18), q), rarities, typeRow),
    grid,
    free,
    draft.cards[slot]
      ? h(
          "button",
          {
            type: "button",
            class: "btn ghost",
            onclick: () => {
              clearBefore(slot);
              closeSheet();
              update();
            },
          },
          t("clearSlot"),
        )
      : null,
  ]);
}

function clearBefore(slot: number): void {
  draft.cards[slot] = null;
  draft.want = draft.want.filter((x) => x !== slot);
  draft.after = draft.after.map((v) => (v === slot ? -1 : v));
}

/* ---------- after ---------- */

function prediction(): { p: number[]; best: number; n: number } | { msg: string } | null {
  if (!ai.on || !draft.want.length || draft.after.some((v) => v >= 0)) return null;
  let M;
  if (ai.who === "all") {
    if (!serverUrl()) return { msg: t("predNoServer") };
    const c = cachedCommunityStats("");
    if (!c) {
      communityStats("")
        .then(() => render())
        .catch(() => {});
      return { msg: t("predLoading") };
    }
    M = c.moveAll;
  } else {
    M = aggregate(loadRecords()).moveAll;
  }
  return predict(M, draft.want) ?? { msg: t("predNoData") };
}

function afterSection(): HTMLElement {
  const p = pack();
  const P = prediction();
  const probs = P && "p" in P ? P : null;
  const slots = [0, 1, 2, 3, 4].map((j) => {
    const from = draft.after[j]!;
    const c = from >= 0 ? draft.cards[from] : null;
    const chosen = draft.get === j;
    const pct = probs ? Math.round(probs.p[j]! * 100) : null;
    return h(
      "div",
      {
        class:
          "slot after" +
          (chosen ? " chosen" : "") +
          (c && draft.want.includes(from) ? " wanted" : "") +
          (probs && probs.best === j ? " best" : ""),
        style: pct !== null ? `--heat:${probs!.p[j]!.toFixed(3)}` : "",
      },
      h(
        "button",
        {
          type: "button",
          class: "slot-btn",
          disabled: !draft.cards.some(Boolean),
          "aria-label": t("afterSlot", { pos: POSITIONS[j]!, name: c ? c.name : t("notSet") }),
          onclick: () => openAfter(j),
        },
        c ? cardFace(c, p.hue, { art: cardArt(p.code, c) }) : cardBack(),
        pct !== null ? h("span", { class: "odds" }, pct + "%") : null,
      ),
      h(
        "button",
        {
          type: "button",
          class: "pick-mark" + (chosen ? " on" : ""),
          "aria-pressed": chosen ? "true" : "false",
          onclick: () => {
            draft.get = chosen ? -1 : j;
            update();
          },
        },
        icon("hand", 15),
        chosen ? t("picked") : t("pick"),
      ),
      h("span", { class: "pos" }, j + 1),
    );
  });

  const aiBox =
    draft.want.length && !draft.after.some((v) => v >= 0)
      ? h(
          "div",
          { class: "ai" + (ai.on ? "" : " off") },
          h(
            "div",
            { class: "ai-head" },
            h("b", null, icon("sparkle", 16), " ", t("predTitle")),
            h(
              "div",
              { class: "seg mini" },
              (["me", "all"] as const).map((w) =>
                h(
                  "button",
                  {
                    type: "button",
                    "aria-pressed": ai.on && ai.who === w ? "true" : "false",
                    onclick: () => {
                      ai.on = true;
                      ai.who = w;
                      store.set("ai", ai);
                      render();
                    },
                  },
                  w === "me" ? t("predMine") : t("predAll"),
                ),
              ),
              h(
                "button",
                {
                  type: "button",
                  "aria-pressed": !ai.on ? "true" : "false",
                  onclick: () => {
                    ai.on = false;
                    store.set("ai", ai);
                    render();
                  },
                },
                t("predOff"),
              ),
            ),
          ),
          ai.on
            ? h(
                "p",
                null,
                P && "msg" in P
                  ? P.msg
                  : probs
                    ? [
                        ...tr("predText", {
                          which: draft.want.length > 1 ? t("predMany") : t("predOne"),
                          pos: `${probs.best + 1} · ${POSITIONS[probs.best]} (${Math.round(probs.p[probs.best]! * 100)}%)`,
                          n: probs.n,
                          chance: Math.round(Math.min(1, draft.want.length / 5) * 100),
                        }),
                        probs.n < 20 ? h("span", { class: "warn" }, t("predFew")) : null,
                      ]
                    : null,
              )
            : null,
        )
      : null;

  return h(
    "section",
    { class: "panel" },
    h("div", { class: "step-head" }, h("span", { class: "step" }, "3"), h("h2", null, t("step3"))),
    h("p", { class: "sub" }, tr("step3Sub")),
    aiBox,
    board(slots),
  );
}

function openAfter(j: number): void {
  const p = pack();
  const rows = [0, 1, 2, 3, 4].map((i) => {
    const c = draft.cards[i];
    const at = draft.after.indexOf(i);
    return h(
      "li",
      null,
      h(
        "button",
        {
          type: "button",
          class: "pick-row" + (at >= 0 && at !== j ? " used" : "") + (at === j ? " current" : ""),
          disabled: !c,
          onclick: () => {
            const next = draft.after.map((v) => (v === i ? -1 : v));
            next[j] = i;
            draft.after = autoComplete(next);
            closeSheet();
            update();
          },
        },
        h("span", { class: "pick-no" }, String(i + 1)),
        h(
          "span",
          { class: "pick-name" },
          c ? c.name : t("emptyCard"),
          at >= 0 && at !== j ? h("small", null, t("nowAt", { n: at + 1 })) : null,
        ),
        draft.want.includes(i) ? h("span", { class: "mini-heart" }, "♥") : null,
        c ? rarityTag(c.r) : null,
      ),
    );
  });
  openSheet(t("posLabel", { n: j + 1, pos: POSITIONS[j]! }), t("afterQ"), [
    h("ul", { class: "pick-list" }, rows),
    draft.after[j]! >= 0
      ? h(
          "button",
          {
            type: "button",
            class: "btn ghost",
            onclick: () => {
              draft.after[j] = -1;
              closeSheet();
              update();
            },
          },
          t("clearSlot"),
        )
      : null,
    h("p", { class: "hint" }, t("packOf", { name: p.name })),
  ]);
}

/* ---------- save ---------- */

const PROBLEM: Record<DraftProblem, "pbCards" | "pbWant" | "pbAfter" | "pbGet"> = {
  cards: "pbCards",
  want: "pbWant",
  after: "pbAfter",
  get: "pbGet",
};

function resultBar(): HTMLElement {
  const problem = draftProblem(draft);
  const hit = !problem && isHit(draft);
  const got = !problem ? draft.cards[draft.after[draft.get]!] : null;
  return h(
    "section",
    { class: "savebar" + (problem ? "" : hit ? " hit" : " miss") },
    h(
      "div",
      { class: "save-msg" },
      problem
        ? h("span", null, t(PROBLEM[problem]))
        : h(
            "span",
            null,
            h("b", null, hit ? t("gotIt") : t("notThisTime")),
            " ",
            tr("youGot", { name: got?.name ?? "?" }),
          ),
    ),
    h(
      "div",
      { class: "save-actions" },
      h(
        "button",
        {
          type: "button",
          class: "btn ghost small",
          onclick: () => {
            if (draft.cards.some(Boolean) && !confirm(t("resetQ"))) return;
            draft = newDraft(draft.pack);
            update();
          },
        },
        icon("undo", 16),
        t("reset"),
      ),
      h("button", { type: "button", class: "btn primary", disabled: !!problem, onclick: save }, t("save")),
    ),
  );
}

function save(): void {
  if (draftProblem(draft)) return;
  const rec = toRecord(draft);
  saveRecords([rec, ...loadRecords()]);
  toast(isHit(rec) ? t("savedHit") : t("saved"));
  draft = newDraft(draft.pack);
  update();
  window.scrollTo({ top: 0, behavior: "smooth" });
  onSaved();
  void pushPending();
}
