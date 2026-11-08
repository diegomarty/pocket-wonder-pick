/** Stats: hit rate against chance, and where cards travel in the shuffle. */

import { MIX, OTHER, PACKS, POSITIONS, RARITY_GROUPS, packByCode, rarityGroupLabel } from "../domain/catalog";
import { t, tr } from "../i18n";
import { CHI2_CRITICAL_4DF, aggregate, chiSquare, type Stats } from "../domain/stats";
import { loadRecords, store } from "../infra/storage";
import { cachedCommunityStats, communityStats, serverUrl } from "../infra/sync";
import { h, icon, replace, type Child } from "./dom";
import { packLogo } from "./pack-logo";

let root: HTMLElement;
const st = store.get("statsView", { who: "me" as "me" | "all", pack: "", from: 2 });
const persist = () => store.set("statsView", st);

export function mountStats(el: HTMLElement): void {
  root = el;
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function renderStats(): void {
  if (!root) return;
  const hasServer = !!serverUrl();
  if (st.who === "all" && !hasServer) st.who = "me";
  const controls = h(
    "section",
    { class: "panel" },
    h("h2", null, t("stats")),
    h(
      "div",
      { class: "seg" },
      h(
        "button",
        { type: "button", "aria-pressed": st.who === "me" ? "true" : "false", onclick: () => setWho("me") },
        t("myLogs"),
      ),
      h(
        "button",
        {
          type: "button",
          "aria-pressed": st.who === "all" ? "true" : "false",
          disabled: !hasServer,
          title: hasServer ? "" : t("needServer"),
          onclick: () => setWho("all"),
        },
        t("community"),
      ),
    ),
    !hasServer ? h("p", { class: "hint" }, t("needServerHint")) : null,
    h(
      "label",
      { class: "field" },
      h("span", null, t("packLabel")),
      h(
        "select",
        {
          onchange: (e: Event) => {
            st.pack = (e.target as HTMLSelectElement).value;
            persist();
            renderStats();
          },
        },
        h("option", { value: "" }, t("allPacks")),
        [...PACKS, MIX, OTHER].map((p) =>
          h("option", { value: p.code, selected: st.pack === p.code }, `${p.code} · ${p.name}`),
        ),
      ),
    ),
  );
  const body = h("div", { class: "stats-body" });
  replace(root, controls, body);

  if (st.who === "me") return draw(body, aggregate(loadRecords(), st.pack), true);
  const cached = cachedCommunityStats(st.pack);
  if (cached) draw(body, cached, false);
  else replace(body, h("p", { class: "panel empty" }, t("loadingCommunity")));
  const pack = st.pack;
  communityStats(pack)
    .then((s) => {
      if (st.who === "all" && st.pack === pack) draw(body, s, false);
    })
    .catch(() => {
      if (!cached) replace(body, h("p", { class: "panel empty" }, t("noConnect")));
    });
}

function setWho(w: "me" | "all"): void {
  st.who = w;
  persist();
  renderStats();
}

function heatBoard(
  values: number[],
  label: (i: number) => Child | Child[],
  opts: { onPick?: (i: number) => void; picked?: number } = {},
) {
  const max = Math.max(...values, 0.0001);
  const tile = (i: number) =>
    h(
      opts.onPick ? "button" : "div",
      {
        ...(opts.onPick
          ? { type: "button", onclick: () => opts.onPick!(i), "aria-pressed": opts.picked === i ? "true" : "false" }
          : {}),
        class: "heat-tile" + (values[i] === max && max > 0.0001 ? " best" : "") + (opts.picked === i ? " picked" : ""),
        style: `--heat:${(values[i]! / max).toFixed(3)}`,
      },
      h("span", { class: "heat-pos" }, i + 1),
      label(i),
    );
  return h(
    "div",
    { class: "heat" },
    h("div", { class: "row" }, [0, 1, 2].map(tile)),
    h("div", { class: "row" }, [3, 4].map(tile)),
  );
}

function draw(body: HTMLElement, S: Stats, mine: boolean): void {
  if (!S.n) {
    replace(
      body,
      h(
        "section",
        { class: "panel empty-state" },
        h("div", { class: "empty-cards", "aria-hidden": "true" }, h("span"), h("span"), h("span")),
        h("h2", null, mine ? t("noDataMine") : t("noDataAll")),
        h("p", null, t("noDataText")),
      ),
    );
    return;
  }
  const rate = pct(S.hit, S.n);
  const chance = pct(S.expect, S.n);
  const diff = rate - chance;
  const from = st.from;
  const row = S.moveAll[from] ?? [0, 0, 0, 0, 0];
  const rowSum = row.reduce((a, b) => a + b, 0);
  const chi = chiSquare(row);
  const wantSum = S.wantAt.reduce((a, b) => a + b, 0);

  replace(
    body,
    h(
      "section",
      { class: "kpis" },
      kpi(t("kLogs"), String(S.n), S.users ? t("kPlayers", { n: S.users }) : mine ? t("kYours") : ""),
      kpi(t("kHits"), rate + "%", t("kOf", { a: S.hit, b: S.n })),
      kpi(t("kChance"), chance + "%", t("kExpected")),
      kpi(
        t("kLuck"),
        (diff > 0 ? "+" : "") + diff + " " + t("pts"),
        diff >= 0 ? t("kAbove") : t("kBelow"),
        diff >= 0 ? "up" : "down",
      ),
    ),
    h(
      "section",
      { class: "panel" },
      h("h3", null, t("whereHit")),
      h("p", { class: "sub" }, t("whereHitSub")),
      heatBoard(
        S.getN.map((n, i) => (n ? S.getHit[i]! / n : 0)),
        (i) => [
          h("b", null, S.getN[i] ? pct(S.getHit[i]!, S.getN[i]!) + "%" : "–"),
          h("small", null, `${S.getHit[i]}/${S.getN[i]}`),
        ],
      ),
    ),
    h(
      "section",
      { class: "panel" },
      h("h3", null, icon("shuffle", 18), " ", t("whereGo")),
      h("p", { class: "sub" }, t("chooseFrom")),
      h(
        "div",
        { class: "from-pick" },
        [0, 1, 2, 3, 4].map((i) =>
          h(
            "button",
            {
              type: "button",
              class: "from-btn",
              "aria-pressed": from === i ? "true" : "false",
              "aria-label": POSITIONS[i],
              onclick: () => {
                st.from = i;
                persist();
                renderStats();
              },
            },
            i + 1,
          ),
        ),
      ),
      h("p", { class: "sub" }, tr("cardIn", { n: from + 1, pos: POSITIONS[from]! })),
      heatBoard(
        row.map((v) => (rowSum ? v / rowSum : 0)),
        (i) => [h("b", null, rowSum ? pct(row[i]!, rowSum) + "%" : "–"), h("small", null, t("times", { n: row[i]! }))],
      ),
      h(
        "p",
        { class: "hint" },
        t("uniform"),
        rowSum < 30
          ? t("fewData")
          : chi > CHI2_CRITICAL_4DF
            ? tr("skewed", { chi: chi.toFixed(1) })
            : t("fair", { chi: chi.toFixed(1) }),
      ),
    ),
    wantSum
      ? h(
          "section",
          { class: "panel" },
          h("h3", null, t("wantEnd")),
          heatBoard(
            S.wantAt.map((v) => v / wantSum),
            (i) => [h("b", null, pct(S.wantAt[i]!, wantSum) + "%"), h("small", null, t("times", { n: S.wantAt[i]! }))],
          ),
        )
      : null,
    h(
      "section",
      { class: "panel" },
      h("h3", null, t("byRarity")),
      bars(
        RARITY_GROUPS.filter((g) => S.rar[g]).map((g) => ({
          label: rarityGroupLabel(g),
          n: S.rar[g]![0],
          hit: S.rar[g]![1],
        })),
        t("picks"),
      ),
    ),
    !st.pack
      ? h(
          "section",
          { class: "panel" },
          h("h3", null, t("byPack")),
          bars(
            Object.entries(S.packs)
              .sort((a, b) => b[1][0] - a[1][0])
              .map(([code, [n, hit]]) => ({
                label: `${code} · ${packByCode(code)?.name ?? ""}`,
                logo: code,
                n,
                hit,
                hue: packByCode(code)?.hue,
              })),
            t("logsLower"),
          ),
        )
      : null,
    !mine ? h("p", { class: "hint center" }, t("communityWarn")) : null,
  );
}

function kpi(label: string, value: string, sub: string, tone = ""): HTMLElement {
  return h("div", { class: "kpi " + tone }, h("span", null, label), h("b", null, value), h("small", null, sub));
}

function bars(
  rows: { label: string; n: number; hit: number; hue?: number | undefined; logo?: string }[],
  nLabel: string,
): HTMLElement {
  if (!rows.length) return h("p", { class: "sub" }, t("noDataShort"));
  return h(
    "ul",
    { class: "bars" },
    rows.map((r) =>
      h(
        "li",
        { style: r.hue !== undefined ? `--h:${r.hue}` : "" },
        h("span", { class: "bar-label" }, r.logo ? packLogo(r.logo, "bar-logo") : null, r.label),
        h("span", { class: "bar" }, h("i", { style: `width:${pct(r.hit, r.n)}%` })),
        h("span", { class: "bar-val" }, `${pct(r.hit, r.n)}%`, h("small", null, `${r.hit}/${r.n} ${nLabel}`)),
      ),
    ),
  );
}
