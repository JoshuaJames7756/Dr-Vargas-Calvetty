import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// El panel se sirve bajo /panel (mismo origen que el sitio y la API en produccion).
export default defineConfig({
  base: "/panel/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    // En desarrollo, las llamadas /api van al Worker local (wrangler dev).
    proxy: { "/api": "http://localhost:8787" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    css: false,
  },
});
