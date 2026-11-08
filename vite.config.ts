/**
 * Build and dev server: plain Vite, one page (`index.html`).
 *
 * `base: "./"` makes every asset URL relative, so the same build works at a domain root
 * (Vercel) and under a subpath (GitHub Pages serves it at `/pocket-wonder-pick/`).
 *
 * From vitest, not vite: it is the same config plus the `test` block. Unit tests cover
 * the framework-free domain under `src/domain/`: no DOM.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
