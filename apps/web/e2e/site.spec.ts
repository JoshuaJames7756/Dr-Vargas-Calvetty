import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Version 1 ("lite", por defecto): la cita se pide por WhatsApp. Con PUBLIC_MODE=full se prueba la agenda en linea (Version 3). */
const FULL = process.env.PUBLIC_MODE === "full";

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
    if (FULL) await expect(page.getByText("Lunes a viernes, de 14:00 a 18:00").first()).toBeVisible();
    else await expect(page.getByText(/Coordina tu día y hora/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Facebook/ }).first()).toHaveAttribute("href", "https://www.facebook.com/ginecologocochabamba/");
  });

  test("contacto: mapa visible y el pie no repite la direccion", async ({ page }) => {
    await page.goto("/contacto/");
    await expect(page.locator('iframe[title^="Mapa"]')).toBeAttached();
    await expect(page.getByRole("link", { name: /Cómo llegar/ }).first()).toBeVisible();
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
      await expect(page.getByRole("heading", { name: "Encuéntranos o escríbenos" })).toBeVisible();
    });
  });

  test("las preguntas frecuentes se abren y se cierran", async ({ page }) => {
    await page.goto("/preguntas/");
    const q = page.getByText("¿Qué datos necesito para pedir una cita?");
    await expect(page.getByText(/No pedimos diagnósticos/)).toBeHidden();
    await q.click();
    await expect(page.getByText(/No pedimos diagnósticos/)).toBeVisible();
    await q.click();
    await expect(page.getByText(/No pedimos diagnósticos/)).toBeHidden();
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

  test("el menu de servicios (escritorio) se abre con el clic, enlaza a las areas y se cierra con Escape", async ({ page, isMobile }) => {
    test.skip(isMobile, "El menu de servicios es solo de escritorio");
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Mostrar especialidades" });
    await toggle.click();
    const panel = page.locator("#svc-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByRole("button", { name: "Ocultar especialidades" })).toHaveAttribute("aria-expanded", "true");
    await expect(panel.getByRole("link", { name: "Oncología" })).toHaveAttribute("href", /\/servicios#oncologia$/);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(page.getByRole("button", { name: "Mostrar especialidades" })).toBeFocused();
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

test.describe("solicitud de cita (agenda en linea, modo full)", () => {
  test.skip(!FULL, "Solo en modo full (Version 3)");
  test("flujo completo: queda PENDIENTE y nunca dice confirmada", async ({ page }) => {
    await mockApi(page);
    await fillUntilReview(page);
    await expect(page.getByRole("heading", { name: "Revisa tu solicitud" })).toBeVisible();
    await expect(page.getByRole("main").getByText("Control prenatal").first()).toBeVisible();

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

test.describe("cita por WhatsApp (modo lite, Version 1)", () => {
  test.skip(FULL, "Solo en modo lite");

  test("valida nombre y servicio y no abre WhatsApp si faltan", async ({ page }) => {
    await page.addInitScript(() => ((window as unknown as { __opened: string[] }).__opened = []));
    await page.addInitScript(() => {
      window.open = ((url?: string | URL) => ((window as unknown as { __opened: string[] }).__opened.push(String(url)), null)) as typeof window.open;
    });
    await page.goto("/cita/");
    await page.getByRole("button", { name: "Abrir WhatsApp con mi mensaje" }).click();
    await expect(page.getByText("Escribe tu nombre para que el consultorio sepa quién eres.")).toBeVisible();
    await expect(page.getByText("Elige el servicio que necesitas.")).toBeVisible();
    await expect(page.getByLabel("Tu nombre completo")).toBeFocused();
    expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened.length)).toBe(0);
  });

  test("arma el mensaje, lo muestra y abre wa.me con el texto codificado", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __opened: string[] }).__opened = [];
      window.open = ((url?: string | URL) => ((window as unknown as { __opened: string[] }).__opened.push(String(url)), null)) as typeof window.open;
    });
    await page.goto("/cita/");
    await page.getByLabel("Tu nombre completo").fill("María Pérez");
    await page.getByLabel("¿Para qué servicio?").selectOption("Oncología");
    await page.getByLabel(/Día que prefieres/).fill("2030-05-14");
    await page.getByLabel(/Horario que prefieres/).selectOption("en la tarde");
    await page.getByLabel(/Motivo breve/).fill("primera consulta");
    const preview = page.locator("#wa-preview");
    await expect(preview).toContainText("Hola, soy María Pérez.");
    await expect(preview).toContainText("para Oncología");
    await expect(preview).toContainText("martes, 14 de mayo");
    await expect(preview).toContainText("Motivo: primera consulta.");

    await page.getByRole("button", { name: "Abrir WhatsApp con mi mensaje" }).click();
    const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatch(/^https:\/\/wa\.me\/59170344225\?text=/);
    expect(decodeURIComponent(opened[0]!.split("?text=")[1]!)).toContain("Hola, soy María Pérez.");
    await expect(page.getByText("Abrimos WhatsApp con tu mensaje.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Toca aquí para abrirlo/ })).toHaveAttribute("href", /wa\.me\/59170344225\?text=/);
  });

  test("ningun texto habla de pendientes o confirmaciones, no hay acceso al panel ni horarios sin confirmar", async ({ page }) => {
    for (const path of ["/", "/cita/", "/preguntas/", "/contacto/", "/servicios/", "/doctor/", "/privacidad/"]) {
      await page.goto(path);
      const text = (await page.locator("body").innerText()).toLowerCase();
      expect(text, path).not.toMatch(/pendiente|confirmaremos|te confirma|tu solicitud|14:00|ejemplo|acceso del consultorio/);
      await expect(page.locator('a[href^="/panel"]'), path).toHaveCount(0);
    }
  });

  test("la pagina de cita no carga Turnstile ni consulta la API", async ({ page }) => {
    const hits: string[] = [];
    page.on("request", (r) => {
      if (/challenges\.cloudflare\.com|\/api\//.test(r.url())) hits.push(r.url());
    });
    await page.goto("/cita/");
    await page.waitForLoadState("networkidle");
    expect(hits).toEqual([]);
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
    test.skip(!FULL, "Solo en modo full (Version 3)");
    await mockApi(page);
    await fillUntilReview(page);
    await expect(page.getByRole("heading", { name: "Revisa tu solicitud" })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});
