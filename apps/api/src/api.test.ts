import { describe, expect, it } from "vitest";
import app from "./index";
import { localNow, utcToLocal } from "./modules/availability/service";

// Entorno de prueba: la base de datos NUNCA se contacta en estos casos
// (las solicitudes se rechazan antes de ejecutar consultas).
const env = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  CLERK_SECRET_KEY: "sk_test_invalid",
  CLERK_PUBLISHABLE_KEY: "pk_test_invalid",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  ALLOWED_ORIGIN: "http://localhost:4321",
  CLINIC_TIMEZONE: "America/La_Paz",
};

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
} as unknown as ExecutionContext;

const call = (path: string, init?: RequestInit) => app.request(path, init, env, ctx);

describe("seguridad de la API", () => {
  it("health responde sin sesion", async () => {
    const res = await call("/api/health");
    expect(res.status).toBe(200);
  });

  it("las rutas privadas rechazan solicitudes sin token (401)", async () => {
    const res = await call("/api/appointments");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it.each(["/api/patients", "/api/patients/00000000-0000-4000-8000-000000000000/notes"])("pacientes y notas exigen sesion: %s (401)", async (path) => {
    expect((await call(path)).status).toBe(401);
  });

  it("los documentos de pacientes exigen sesion: listar, subir, descargar y eliminar (401)", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect((await call(`/api/patients/${id}/documents`)).status).toBe(401);
    expect((await call(`/api/patients/${id}/documents`, { method: "POST", body: new FormData() })).status).toBe(401);
    expect((await call(`/api/documents/${id}/file`)).status).toBe(401);
    expect((await call(`/api/documents/${id}`, { method: "DELETE" })).status).toBe(401);
  });

  it("el vinculo cita-paciente exige sesion (401)", async () => {
    const res = await call("/api/appointments/00000000-0000-4000-8000-000000000000/patient", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
    expect(res.status).toBe(401);
  });

  it("las rutas privadas rechazan un token invalido (401)", async () => {
    const res = await call("/api/appointments", { headers: { Authorization: "Bearer no-es-un-jwt" } });
    expect(res.status).toBe(401);
  });

  it("cambiar estados sin sesion esta prohibido (401)", async () => {
    const res = await call("/api/appointments/3f2b0f3e-6c1d-4a58-9a52-7d1f2d5b1a10/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "CONFIRMED" }),
    });
    expect(res.status).toBe(401);
  });

  it("la disponibilidad privada exige sesion (GET, PUT y DELETE)", async () => {
    expect((await call("/api/availability")).status).toBe(401);
    expect((await call("/api/availability/weekly", { method: "PUT", body: "{}", headers: { "Content-Type": "application/json" } })).status).toBe(401);
    expect((await call("/api/availability/exceptions/2026-12-25", { method: "DELETE" })).status).toBe(401);
  });

  it("/api/me exige sesion", async () => {
    expect((await call("/api/me")).status).toBe(401);
  });

  it("los errores no filtran informacion interna", async () => {
    const res = await call("/api/appointments");
    const text = await res.text();
    expect(text).not.toMatch(/stack|postgres|sk_test/i);
  });

  it("incluye cabeceras de seguridad", async () => {
    const res = await call("/api/health");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("validacion de entradas publicas", () => {
  it("rechaza una solicitud de cita vacia (400)", async () => {
    const res = await call("/api/public/appointment-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("rechaza una solicitud sin consentimiento (400)", async () => {
    const res = await call("/api/public/appointment-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Maria Perez",
        phone: "70344225",
        serviceId: "3f2b0f3e-6c1d-4a58-9a52-7d1f2d5b1a10",
        startsAt: "2026-10-19T13:00:00.000Z",
        turnstileToken: "x",
        consent: false,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rechaza una fecha de disponibilidad con formato invalido (400)", async () => {
    const res = await call("/api/public/availability?serviceId=3f2b0f3e-6c1d-4a58-9a52-7d1f2d5b1a10&date=hoy");
    expect(res.status).toBe(400);
  });

  it("rechaza un mensaje de contacto sin verificacion (400)", async () => {
    const res = await call("/api/public/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Ana", phone: "70344225", message: "hola" }),
    });
    expect(res.status).toBe(400);
  });

  it("devuelve 404 coherente para rutas inexistentes", async () => {
    const res = await call("/api/public/nada");
    expect(res.status).toBe(404);
  });
});

describe("hora local del consultorio", () => {
  it("09:00 en La Paz es 13:00 UTC", () => {
    expect(utcToLocal(new Date("2026-10-19T13:00:00.000Z"))).toEqual({ date: "2026-10-19", minute: 540 });
  });

  it("cruza correctamente la medianoche local", () => {
    // 02:00 UTC del 20 es 22:00 del dia 19 en La Paz
    expect(utcToLocal(new Date("2026-10-20T02:00:00.000Z"))).toEqual({ date: "2026-10-19", minute: 22 * 60 });
  });

  it("localNow devuelve una fecha con formato valido", () => {
    expect(localNow().date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("panel (SPA)", () => {
  const assets = {
    fetch: async (req: Request) => {
      const path = new URL(req.url).pathname;
      if (path === "/panel/index.html") return new Response("<html>panel</html>", { headers: { "content-type": "text/html" } });
      return new Response("no", { status: 404 });
    },
  };
  const withAssets = (path: string) => app.request(path, undefined, { ...env, ASSETS: assets }, ctx);

  it("una ruta del panel sin archivo devuelve index.html", async () => {
    const res = await withAssets("/panel/agenda");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("panel");
  });
  it("un archivo inexistente con extension responde 404, no index.html", async () => {
    expect((await withAssets("/panel/falta.js")).status).toBe(404);
  });
  it("sin recursos estaticos configurados responde 404", async () => {
    expect((await call("/panel/agenda")).status).toBe(404);
  });
});
