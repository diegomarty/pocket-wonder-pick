/**
 * Build and dev server: plain Vite, one page (`index.html`).
 *
 * From vitest, not vite: it is the same config plus the `test` block. Unit tests cover
 * the framework-free domain under `src/domain/`: no DOM.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
