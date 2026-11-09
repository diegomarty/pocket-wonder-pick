/** Stats: hit rate against chance, and where cards travel in the shuffle. */

import { MIX, OTHER, PACKS, POSITIONS, RARITY_GROUPS, packByCode, rarityGroupLabel } from "../domain/catalog";
import { t, tr } from "../i18n";
import { CHI2_CRITICAL_4DF, PERIODS, aggregate, chiSquare, sampleStats, type Stats } from "../domain/stats";
import { loadRecords, store } from "../infra/storage";
import { cachedCommunityStats, communityStats, serverUrl } from "../infra/sync";
import { h, icon, replace, type Child } from "./dom";
import { packLogo } from "./pack-logo";

let root: HTMLElement;
const st = {
  who: "me" as "me" | "all",
  pack: "",
  from: 2,
  days: 0,
  /** Whose moves the shuffle panels count: all five cards, or only the ♥ ones. */
  scope: "all" as "all" | "want",
  ...store.get<object>("statsView", {}),
};
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
    h(
      "label",
      { class: "field" },
      h("span", null, t("period")),
      h(
        "select",
        {
          onchange: (e: Event) => {
            st.days = Number((e.target as HTMLSelectElement).value) || 0;
            persist();
            renderStats();
          },
        },
        PERIODS.map((d) =>
          h("option", { value: String(d), selected: st.days === d }, d ? t("lastDays", { n: d }) : t("allTime")),
        ),
      ),
    ),
  );
  const body = h("div", { class: "stats-body" });
  replace(root, controls, body);

  const { pack, days } = st;
  if (st.who === "me") {
    draw(body, aggregate(loadRecords(), pack, days), true);
    // Fetch the community totals in the background, once, for the comparison figures.
    if (hasServer && !cachedCommunityStats(pack, days) && !tried.has(pack + ":" + days)) {
      tried.add(pack + ":" + days);
      communityStats(pack, days)
        .then(() => st.who === "me" && st.pack === pack && st.days === days && renderStats())
        .catch(() => {});
    }
    return;
  }
  const cached = cachedCommunityStats(pack, days);
  if (cached) draw(body, cached, false);
  else replace(body, h("p", { class: "panel empty" }, t("loadingCommunity")));
  communityStats(pack, days)
    .then((s) => {
      if (st.who === "all" && st.pack === pack && st.days === days) draw(body, s, false);
    })
    .catch(() => {
      if (!cached) replace(body, h("p", { class: "panel empty" }, t("noConnect")));
    });
}

/** Community totals already asked for in this visit, so a failure is not retried on every render. */
const tried = new Set<string>();

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

function draw(body: HTMLElement, S: Stats, mine: boolean, sample = false): void {
  if (!S.n) {
    // Nothing logged yet: show what the tab will look like, clearly marked as an example.
    if (mine && !sample) return draw(body, sampleStats(), true, true);
    replace(
      body,
      h(
        "section",
        { class: "panel empty-state" },
        h("div", { class: "empty-cards", "aria-hidden": "true" }, h("span"), h("span"), h("span")),
        h("h2", null, t("noDataAll")),
        h("p", null, t("noDataText")),
      ),
    );
    return;
  }
  const rate = pct(S.hit, S.n);
  const chance = pct(S.expect, S.n);
  const diff = rate - chance;
  const from = st.from;
  const M = st.scope === "want" ? S.moveWant : S.moveAll;
  const row = M[from] ?? [0, 0, 0, 0, 0];
  const rowSum = row.reduce((a, b) => a + b, 0);
  const chi = chiSquare(row);
  const wantSum = S.wantAt.reduce((a, b) => a + b, 0);
  // In "mine", the community's figures for the same row, when they are at hand.
  const A = mine && !sample ? cachedCommunityStats(st.pack, st.days) : null;
  const aRow = A ? (st.scope === "want" ? A.moveWant : A.moveAll)[from] : null;
  const aSum = aRow ? aRow.reduce((a, b) => a + b, 0) : 0;
  const best = row.indexOf(Math.max(...row));

  replace(
    body,
    sample ? h("p", { class: "sample-note" }, icon("sparkle", 16), " ", t("sampleNote")) : null,
    st.days && !mine && !S.days ? h("p", { class: "hint" }, t("noPeriodServer")) : null,
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
      { class: "panel key" },
      h("h3", null, icon("shuffle", 18), " ", t("whereGo")),
      h(
        "div",
        { class: "seg mini scope" },
        (["all", "want"] as const).map((v) =>
          h(
            "button",
            {
              type: "button",
              "aria-pressed": st.scope === v ? "true" : "false",
              onclick: () => {
                st.scope = v;
                persist();
                renderStats();
              },
            },
            v === "all" ? t("scopeAll") : t("scopeWant"),
          ),
        ),
      ),
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
            h("small", null, t("times", { n: M[i]!.reduce((a, b) => a + b, 0) })),
          ),
        ),
      ),
      rowSum
        ? [
            h("p", { class: "sub" }, tr("cardIn", { n: from + 1, pos: POSITIONS[from]! })),
            heatBoard(
              row.map((v) => v / rowSum),
              (i) => [
                h("b", null, pct(row[i]!, rowSum) + "%"),
                h("small", null, t("times", { n: row[i]! })),
                aSum ? h("small", { class: "cmp" }, t("cmpAll", { p: pct(aRow![i]!, aSum) })) : null,
              ],
            ),
            h(
              "p",
              { class: "advice" },
              ...tr("advice", {
                from: `${from + 1} · ${POSITIONS[from]}`,
                to: `${best + 1} · ${POSITIONS[best]} (${pct(row[best]!, rowSum)}%)`,
                n: rowSum,
              }),
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
            aSum ? h("p", { class: "hint" }, t("cmpNote")) : null,
          ]
        : h("p", { class: "sub" }, t("noFrom", { n: from + 1, pos: POSITIONS[from]! })),
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
    wantSum
      ? h(
          "section",
          { class: "panel" },
          h("h3", null, t("wantEnd")),
          heatBoard(
            S.wantAt.map((v) => v / wantSum),
            (i) => [h("b", null, pct(S.wantAt[i]!, wantSum) + "%"), h("small", null, t("times", { n: S.wantAt[i]! }))],
          ),
          h("p", { class: "hint" }, t("uniform")),
        )
      : null,
    h(
      "section",
      { class: "panel" },
      h("h3", null, st.scope === "want" ? t("matrixWant") : t("matrixAll")),
      matrix(M),
      h("p", { class: "hint" }, t("matrixNote")),
    ),
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
    S.n < 30 && !sample ? h("p", { class: "hint center" }, t("fewLogs", { n: S.n })) : null,
    !mine && S.updated
      ? h(
          "p",
          { class: "hint center" },
          t("updatedAt", { when: new Date(S.updated).toLocaleString(), n: S.users ?? 0 }),
        )
      : null,
    !mine ? h("p", { class: "hint center" }, t("communityWarn")) : null,
  );
}

/** The whole before → after table: one row per slot before, each row adding up to 100%. */
function matrix(M: number[][]): HTMLElement {
  const short = (i: number) => String(i + 1);
  return h(
    "div",
    { class: "mx-wrap" },
    h(
      "table",
      { class: "mx" },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", { scope: "col" }, t("mxCorner")),
          [0, 1, 2, 3, 4].map((j) => h("th", { scope: "col", title: POSITIONS[j] }, short(j))),
        ),
      ),
      h(
        "tbody",
        null,
        M.map((row, i) => {
          const sum = row.reduce((a, b) => a + b, 0);
          const mx = Math.max(...row);
          return h(
            "tr",
            null,
            h("th", { scope: "row", title: POSITIONS[i] }, short(i)),
            row.map((v) =>
              h(
                "td",
                {
                  class: sum && v === mx && v > 0 ? "top" : "",
                  style: sum ? `--heat:${Math.min(1, (v / sum) * 2.5).toFixed(3)}` : "",
                },
                sum ? pct(v, sum) + "%" : "–",
              ),
            ),
          );
        }),
      ),
    ),
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
