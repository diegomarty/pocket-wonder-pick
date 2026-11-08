/** Bottom sheets and toasts, shared by every view. */

import { t } from "../i18n";
import { h, icon, type Child } from "./dom";

let open: { el: HTMLElement; prevFocus: Element | null; onClose?: () => void } | null = null;

export function closeSheet(): void {
  if (!open) return;
  const { el, prevFocus, onClose } = open;
  open = null;
  el.classList.remove("in");
  document.body.classList.remove("locked");
  setTimeout(() => el.remove(), 200);
  onClose?.();
  if (prevFocus instanceof HTMLElement) prevFocus.focus();
}

export function openSheet(title: string, sub: Child, body: Child[], onClose?: () => void): HTMLElement {
  closeSheet();
  const panel = h(
    "div",
    { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": title, tabindex: "-1" },
    h("div", { class: "grip", "aria-hidden": "true" }),
    h(
      "header",
      { class: "sheet-head" },
      h("div", null, h("h2", null, title), sub ? h("p", { class: "sub" }, sub) : null),
      h("button", { class: "icon-btn", type: "button", "aria-label": t("close"), onclick: closeSheet }, icon("x")),
    ),
    h("div", { class: "sheet-body" }, ...body),
  );
  const wrap = h("div", { class: "sheet-wrap", onclick: (e: Event) => e.target === wrap && closeSheet() }, panel);
  document.body.append(wrap);
  document.body.classList.add("locked");
  open = { el: wrap, prevFocus: document.activeElement, ...(onClose ? { onClose } : {}) };
  requestAnimationFrame(() => {
    wrap.classList.add("in");
    // On a touch screen, focusing the search box would open the keyboard over half the
    // list; most picks are a tap, so focus the sheet itself and let a tap open it.
    const touch = matchMedia("(pointer: coarse)").matches;
    const first = touch ? panel : panel.querySelector<HTMLElement>("input, .sheet-body button");
    first?.focus({ preventScroll: true });
  });
  return panel;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSheet();
});

let toastTimer = 0;
export function toast(text: string, opts: { error?: boolean; action?: { label: string; run: () => void } } = {}): void {
  document.querySelector(".toast")?.remove();
  const t = h(
    "div",
    { class: "toast" + (opts.error ? " error" : ""), role: "status" },
    h("span", null, text),
    opts.action
      ? h(
          "button",
          {
            type: "button",
            onclick: () => {
              opts.action!.run();
              t.remove();
            },
          },
          opts.action.label,
        )
      : null,
  );
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.remove(), opts.action ? 6000 : 3000);
}
