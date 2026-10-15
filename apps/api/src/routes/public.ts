import { zValidator } from "@hono/zod-validator";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { appointmentRequestSchema, availabilityQuerySchema, contactMessageSchema } from "@dr-vargas/shared";
import { contactMessages, services } from "../db/schema";
import type { AppEnv } from "../env";
import { audit } from "../lib/audit";
import { AppError } from "../lib/errors";
import { verifyTurnstile } from "../lib/turnstile";
import { getAvailableSlots, utcToLocal } from "../modules/availability/service";
import { createAppointmentRequest } from "../modules/appointments/service";
import { minutesToHHMM } from "@dr-vargas/shared";

/** Rutas publicas: sin sesion. Toda entrada se valida con Zod y los envios pasan por Turnstile. */
export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get("/services", async (c) => {
  const rows = await c.get("db")
    .select({
      id: services.id,
      slug: services.slug,
      name: services.name,
      specialty: services.specialty,
      durationMinutes: services.durationMinutes,
      bookable: services.bookable,
    })
    .from(services)
    .where(eq(services.published, true))
    .orderBy(asc(services.sortOrder), asc(services.name));
  c.header("Cache-Control", "public, max-age=300");
  return c.json({ services: rows });
});

publicRoutes.get("/availability", zValidator("query", availabilityQuerySchema), async (c) => {
  const { serviceId, date } = c.req.valid("query");
  const result = await getAvailableSlots(c.get("db"), serviceId, date);
  // Las horas se devuelven ya formateadas en hora local del consultorio.
  // El instante exacto (UTC) lo reconstruye el servidor al recibir la solicitud.
  return c.json({
    date: result.date,
    timezone: c.env.CLINIC_TIMEZONE,
    durationMinutes: result.service.durationMinutes,
    slots: result.slots.map((s) => ({ startMinute: s.startMinute, label: minutesToHHMM(s.startMinute) })),
  });
});

publicRoutes.post("/appointment-requests", zValidator("json", appointmentRequestSchema), async (c) => {
  const input = c.req.valid("json");
  const ip = c.req.header("CF-Connecting-IP");

  const human = await verifyTurnstile(c.env.TURNSTILE_SECRET_KEY, input.turnstileToken, ip);
  if (!human) throw new AppError(400, "TURNSTILE_FAILED", "No pudimos verificar que eres una persona. Inténtalo de nuevo.");

  const created = await createAppointmentRequest(c.get("db"), input);

  // Respuesta honesta: es una SOLICITUD pendiente, no una cita confirmada.
  return c.json(
    {
      status: "PENDING",
      message: "Recibimos tu solicitud. Aún no es una cita confirmada: el consultorio la revisará y te confirmará.",
      requestId: created.id,
      startsAt: created.startsAt.toISOString(),
      local: utcToLocal(created.startsAt),
    },
    201,
  );
});

publicRoutes.post("/contact", zValidator("json", contactMessageSchema), async (c) => {
  const input = c.req.valid("json");
  const ip = c.req.header("CF-Connecting-IP");

  const human = await verifyTurnstile(c.env.TURNSTILE_SECRET_KEY, input.turnstileToken, ip);
  if (!human) throw new AppError(400, "TURNSTILE_FAILED", "No pudimos verificar que eres una persona. Inténtalo de nuevo.");

  const db = c.get("db");
  const [row] = await db
    .insert(contactMessages)
    .values({ fullName: input.fullName, phone: input.phone, message: input.message })
    .returning({ id: contactMessages.id });
  await audit(db, { actorType: "public", action: "contact.received", entityType: "contact_message", entityId: row?.id });

  return c.json({ message: "Recibimos tu mensaje. El consultorio te responderá lo antes posible." }, 201);
});
