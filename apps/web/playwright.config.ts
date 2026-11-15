import { defineConfig, devices } from "@playwright/test";

const PORT = 4400;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  // PW_CHROMIUM: ruta opcional a un Chromium ya instalado (entornos donde no se puede descargar el navegador).
  use: { ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}), baseURL: `http://localhost:${PORT}`, locale: "es-BO", timezoneId: "America/La_Paz", reducedMotion: "reduce" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Sirve el build estatico (generado por `pnpm test:e2e`).
  webServer: {
    command: `pnpm exec sirv dist --port ${PORT} --quiet`,
    port: PORT,
    reuseExistingServer: true,
  },
});
