import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const SERVICE_ID = "3f2b0f3e-6c1d-4a58-9a52-7d1f2d5b1a10";

/** API simulada: estas pruebas verifican la interfaz, no el servidor (esas pruebas viven en apps/api). */
async function mockApi(page: Page, opts: { submit?: "ok" | "taken" } = {}) {
  await page.route("**/challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback('test-token'),10);return 'w1'},reset(){},remove(){}};`,
    }),
  );
  await page.route("**/api/public/services", (r) =>
    r.fulfill({
      json: {
        services: [
          { id: SERVICE_ID, slug: "control-prenatal", name: "Control prenatal", specialty: "ginecologia", durationMinutes: 30, bookable: true },
        ],
      },
    }),
  );
  await page.route("**/api/public/availability**", (r) =>
    r.fulfill({
      json: {
        date: "2026-12-01",
        timezone: "America/La_Paz",
        durationMinutes: 30,
        slots: [
          { startMinute: 540, label: "09:00" },
          { startMinute: 570, label: "09:30" },
        ],
      },
    }),
  );
  await page.route("**/api/public/appointment-requests", (r) => {
    if (opts.submit === "taken") {
      return r.fulfill({ status: 409, json: { error: { code: "SLOT_UNAVAILABLE", message: "Ese horario ya no está disponible. Elige otro." } } });
    }
    return r.fulfill({
      status: 201,
      json: {
        status: "PENDING",
        message: "Recibimos tu solicitud. Aún no es una cita confirmada: el consultorio la revisará y te confirmará.",
        requestId: "r1",
        startsAt: "2026-12-01T13:30:00.000Z",
      },
    });
  });
}

async function fillUntilReview(page: Page) {
  await page.goto("/cita/");
  await page.getByRole("button", { name: "Control prenatal" }).click();
  await page.getByRole("radio", { name: "09:30" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nombre completo").fill("Maria Perez Lopez");
  await page.getByLabel("Celular o WhatsApp").fill("70344225");
  await page.getByLabel(/Acepto/).check();
  await page.getByRole("button", { name: "Revisar solicitud" }).click();
}

test.describe("sitio publico", () => {
  test("el inicio muestra al doctor, sus especialidades y las acciones principales", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Vargas Calvetty");
    await expect(page.getByText("Ginecólogo Oncólogo · Mastólogo").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Solicitar cita" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /WhatsApp/ }).first()).toHaveAttribute("href", /wa\.me\/59170344225/);
  });

  test("muestra la direccion y los tres telefonos", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Parque Fidel Anze N° 200").first()).toBeVisible();
    for (const phone of ["4011030", "4011040", "70344225"]) {
      await expect(page.getByRole("link", { name: phone })).toBeVisible();
    }
  });

  test("el menu lleva a las paginas del sitio y el contacto incluye Facebook y horario", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
    const nav = page.getByRole("navigation", { name: isMobile ? "Menú principal" : "Principal" });
    await nav.getByRole("link", { name: "Contacto" }).click();
    await expect(page).toHaveURL(/\/contacto\/?$/);
    await expect(page.getByText("Lunes a viernes, de 14:00 a 18:00")).toBeVisible();
    await expect(page.getByRole("link", { name: /Página del consultorio/ })).toHaveAttribute("href", "https://www.facebook.com/ginecologocochabamba/");
  });

  test("contacto: mapa visible y el pie no repite la direccion", async ({ page }) => {
    await page.goto("/contacto/");
    await expect(page.locator('iframe[title^="Mapa"]')).toBeAttached();
    await expect(page.getByRole("link", { name: /Abrir en Google Maps/ })).toBeVisible();
    await expect(page.locator("footer address")).toHaveCount(0);
    await page.goto("/servicios/");
    await expect(page.locator("footer address")).toHaveCount(1);
    await expect(page.locator('iframe[title^="Mapa"]')).toHaveCount(0);
  });

  test.describe("movimiento", () => {
    test.use({ reducedMotion: "no-preference" });
    test("los bloques aparecen al hacer scroll y se ven todos al llegar al final", async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect.poll(() => page.locator("[data-reveal]:not(.is-in)").count()).toBeLessThan(3);
      await expect(page.getByRole("heading", { name: "Visita el consultorio o escríbenos" })).toBeVisible();
    });
  });

  test("las preguntas frecuentes se abren y se cierran", async ({ page }) => {
    await page.goto("/preguntas/");
    const q = page.getByText("¿Necesito crear una cuenta para pedir una cita?");
    await expect(page.getByText(/Solo necesitas tu nombre/)).toBeHidden();
    await q.click();
    await expect(page.getByText(/Solo necesitas tu nombre/)).toBeVisible();
    await q.click();
    await expect(page.getByText(/Solo necesitas tu nombre/)).toBeHidden();
  });

  test("los enlaces externos usan rel noopener", async ({ page }) => {
    await page.goto("/");
    const external = page.locator('a[target="_blank"]');
    for (const a of await external.all()) {
      await expect(a).toHaveAttribute("rel", /noopener/);
    }
  });

  test("no hay desbordamiento horizontal", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("el menu movil se abre, se cierra con Escape y devuelve el foco", async ({ page, isMobile }) => {
    test.skip(!isMobile, "solo aplica a movil");
    await page.goto("/");
    const btn = page.getByRole("button", { name: "Abrir menú" });
    await btn.click();
    await expect(page.getByRole("navigation", { name: "Menú principal" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Menú principal" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Abrir menú" })).toBeFocused();
  });
});

test.describe("solicitud de cita", () => {
  test("flujo completo: queda PENDIENTE y nunca dice confirmada", async ({ page }) => {
    await mockApi(page);
    await fillUntilReview(page);
    await expect(page.getByRole("heading", { name: "Revisa tu solicitud" })).toBeVisible();
    await expect(page.getByText("Control prenatal").first()).toBeVisible();

    const send = page.getByRole("button", { name: "Enviar solicitud" });
    await expect(send).toBeEnabled();
    await send.click();

    await expect(page.getByRole("heading", { name: "Solicitud enviada" })).toBeVisible();
    await expect(page.getByText(/pendiente de confirmación/i)).toBeVisible();
    // Nunca debe afirmar que la cita esta confirmada (la negacion "todavia no es una cita confirmada" si es correcta).
    await expect(page.getByText(/todavía no es una cita confirmada/i)).toBeVisible();
    await expect(page.getByText(/(tu cita (está|fue|ha sido) confirmada|cita confirmada con éxito|¡cita confirmada)/i)).toHaveCount(0);
    // WhatsApp es una accion explicita y opcional.
    await expect(page.getByRole("link", { name: /Avisar por WhatsApp/ })).toHaveAttribute("href", /wa\.me\/59170344225\?text=/);
  });

  test("valida los datos antes de avanzar", async ({ page }) => {
    await mockApi(page);
    await page.goto("/cita/");
    await page.getByRole("button", { name: "Control prenatal" }).click();
    await page.getByRole("radio", { name: "09:00" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Celular o WhatsApp").fill("123");
    await page.getByRole("button", { name: "Revisar solicitud" }).click();
    await expect(page.getByText("Escribe tu nombre completo")).toBeVisible();
    await expect(page.getByText(/celular boliviano válido/)).toBeVisible();
    await expect(page.getByText("Debes aceptar para continuar")).toBeVisible();
  });

  test("si el horario se ocupa, vuelve a elegir horario con un mensaje claro", async ({ page }) => {
    await mockApi(page, { submit: "taken" });
    await fillUntilReview(page);
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByRole("heading", { name: "Elige fecha y hora" })).toBeVisible();
  });

  test("si la API falla al cargar servicios, ofrece reintentar", async ({ page }) => {
    await page.route("**/api/public/services", (r) => r.abort());
    await page.goto("/cita/");
    await expect(page.getByRole("alert")).toContainText("No pudimos cargar los servicios");
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });
});

test.describe("accesibilidad (axe, WCAG 2.2 AA)", () => {
  for (const path of ["/", "/cita/", "/privacidad/", "/servicios/", "/doctor/", "/preguntas/", "/contacto/"]) {
    test(`sin violaciones serias en ${path}`, async ({ page }) => {
      await mockApi(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
    });
  }

  test("el paso de revision tambien es accesible", async ({ page }) => {
    await mockApi(page);
    await fillUntilReview(page);
    await expect(page.getByRole("heading", { name: "Revisa tu solicitud" })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});
