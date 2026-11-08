/** Settings: language, community server, moving data between devices, and the small print. */

import { LANGS, LANG_NAMES, lang, setLang, t, type Lang } from "../i18n";
import { adoptOwnerCode, exportJson, importJson, loadRecords, ownerCode, saveRecords } from "../infra/storage";
import { isValidServerUrl, ping, pullMine, pushPending, serverUrl, setServerUrl } from "../infra/sync";
import { h, icon, replace } from "./dom";
import { toast } from "./sheet";

let root: HTMLElement;
let onData: () => void = () => {};

export function mountSettings(el: HTMLElement, changed: () => void): void {
  root = el;
  onData = changed;
}

export function renderSettings(): void {
  if (!root) return;
  const url = h("input", {
    type: "url",
    value: serverUrl(),
    placeholder: "https://script.google.com/macros/s/…/exec",
    autocomplete: "off",
    spellcheck: "false",
  });
  const status = h("p", { class: "hint", role: "status" });
  const code = h("input", { value: ownerCode(), readonly: true, "aria-label": t("linkCode") });
  const file = h("input", { type: "file", accept: "application/json,.json", class: "vh" });
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const n = importJson(await f.text());
      toast(n ? t("imported", { n }) : t("nothingNew"));
      onData();
      void pushPending();
    } catch {
      toast(t("badFile"), { error: true });
    }
    file.value = "";
  });

  const pending = loadRecords().filter((r) => !r.synced && !r.deleted).length;

  replace(
    root,
    h(
      "section",
      { class: "panel" },
      h("h2", null, t("language")),
      h(
        "div",
        { class: "seg", role: "group", "aria-label": t("language") },
        LANGS.map((l: Lang) =>
          h(
            "button",
            {
              type: "button",
              lang: l,
              "aria-pressed": l === lang ? "true" : "false",
              onclick: () => l !== lang && setLang(l),
            },
            LANG_NAMES[l],
          ),
        ),
      ),
    ),
    h(
      "section",
      { class: "panel" },
      h("h2", null, icon("cloud", 20), " ", t("server")),
      h("p", { class: "sub" }, t("serverText"), h("code", null, "apps-script/wonder-pick.gs"), "."),
      h("label", { class: "field" }, h("span", null, t("serverUrl")), url),
      h(
        "div",
        { class: "actions" },
        h(
          "button",
          {
            type: "button",
            class: "btn primary small",
            onclick: async () => {
              const v = url.value.trim();
              if (v && !isValidServerUrl(v)) {
                status.textContent = t("mustBeGoogle");
                return;
              }
              if (v) {
                status.textContent = t("checking");
                if (!(await ping(v))) {
                  status.textContent = t("badServer");
                  return;
                }
              }
              setServerUrl(v);
              status.textContent = v ? t("connected") : t("removed");
              if (v) {
                await pushPending();
                await pullMine(true);
              }
              onData();
              renderSettings();
            },
          },
          t("save"),
        ),
      ),
      status,
      serverUrl() ? h("p", { class: "hint" }, pending ? t("pending", { n: pending }) : t("allSent")) : null,
    ),
    h(
      "section",
      { class: "panel" },
      h("h2", null, icon("link", 20), " ", t("otherDevice")),
      h("p", { class: "sub" }, t("otherDeviceText")),
      h(
        "div",
        { class: "free-row" },
        code,
        h(
          "button",
          {
            type: "button",
            class: "btn small",
            onclick: async () => {
              try {
                await navigator.clipboard.writeText(code.value);
                toast(t("copied"));
              } catch {
                code.select();
              }
            },
          },
          t("copy"),
        ),
      ),
      h(
        "details",
        { class: "free" },
        h("summary", null, t("pasteCode")),
        (() => {
          const other = h("input", { placeholder: "xxxxxxxx.yyyyyyyy", autocomplete: "off", spellcheck: "false" });
          return h(
            "div",
            { class: "free-row" },
            other,
            h(
              "button",
              {
                type: "button",
                class: "btn small",
                onclick: async () => {
                  if (!adoptOwnerCode(other.value)) return toast(t("badCode"), { error: true });
                  saveRecords(loadRecords().map((r) => ({ ...r, synced: false })));
                  toast(t("linked"));
                  await pullMine(true);
                  await pushPending();
                  onData();
                  renderSettings();
                },
              },
              t("link"),
            ),
          );
        })(),
      ),
    ),
    h(
      "section",
      { class: "panel" },
      h("h2", null, t("backup")),
      h("p", { class: "sub" }, t("onDevice", { n: loadRecords().filter((r) => !r.deleted).length })),
      h(
        "div",
        { class: "actions" },
        h(
          "button",
          {
            type: "button",
            class: "btn small",
            onclick: () => {
              const blob = new Blob([exportJson()], { type: "application/json" });
              const a = h("a", {
                href: URL.createObjectURL(blob),
                download: `wonder-pick-${new Date().toISOString().slice(0, 10)}.json`,
              });
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            },
          },
          icon("download", 16),
          t("export"),
        ),
        h(
          "button",
          { type: "button", class: "btn small", onclick: () => file.click() },
          icon("upload", 16),
          t("import"),
        ),
        file,
      ),
      h(
        "button",
        {
          type: "button",
          class: "btn ghost small danger",
          onclick: () => {
            if (!confirm(t("deleteAllQ"))) return;
            // Without a server there is nobody to tell, so nothing needs to be kept as a tombstone.
            saveRecords(serverUrl() ? loadRecords().map((r) => ({ ...r, deleted: true, delSynced: false })) : []);
            void pushPending();
            onData();
            renderSettings();
          },
        },
        icon("trash", 16),
        t("deleteAll"),
      ),
    ),
    h("section", { class: "panel about" }, h("h2", null, t("about")), h("p", null, t("aboutText"))),
  );
}
