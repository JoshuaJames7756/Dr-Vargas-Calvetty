// @ts-check
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Dominio definitivo: pendiente de compra. Cambiar `site` cuando exista (afecta sitemap y canonical).
const SITE = process.env.PUBLIC_SITE_URL ?? "https://dr-vargas.example";

export default defineConfig({
  site: SITE,
  output: "static",
  integrations: [react(), sitemap({ filter: (page) => !page.includes("/panel") })],
  vite: {
    plugins: [tailwindcss()],
  },
  server: { port: 4321 },
});
