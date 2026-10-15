import { defineConfig } from "vitest/config";

// Las pruebas de navegador (e2e/) las ejecuta Playwright, no Vitest.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
