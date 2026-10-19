import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { APPOINTMENT_STATUSES, changeStatusSchema, linkPatientSchema } from "@dr-vargas/shared";
import type { AppEnv } from "../env";
import { linkAppointmentToPatient } from "../modules/patients/service";
import { changeAppointmentStatus, getAppointmentStats, listAppointments, rescheduleAppointment, setReminderSent } from "../modules/appointments/service";

/** Rutas privadas: el middleware requireStaff se aplica al montar este router (ver index.ts). */
export const appointmentRoutes = new Hono<AppEnv>();

const listQuery = z.object({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

appointmentRoutes.get("/", zValidator("query", listQuery), async (c) => {
  const q = c.req.valid("query");
  const rows = await listAppointments(c.get("db"), {
    status: q.status,
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
    limit: q.limit,
  });
  return c.json({ appointments: rows });
});

const statsQuery = z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) });

appointmentRoutes.get("/stats", zValidator("query", statsQuery), async (c) => {
  const q = c.req.valid("query");
  const from = new Date(q.from);
  const to = new Date(q.to);
  // Rango acotado (maximo 400 dias) para que una consulta no recorra toda la tabla.
  if (!(to > from) || to.getTime() - from.getTime() > 400 * 86_400_000) return c.json({ error: { code: "BAD_RANGE", message: "Rango de fechas no valido" } }, 400);
  return c.json({ stats: await getAppointmentStats(c.get("db"), from, to) });
});

appointmentRoutes.patch(
  "/:id/status",
  zValidator("param", z.object({ id: z.string().uuid() })),
  zValidator("json", changeStatusSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { to, note } = c.req.valid("json");
    const updated = await changeAppointmentStatus(c.get("db"), { id, to, note, actorStaffId: c.get("staff").id });
    return c.json({ appointment: updated });
  },
);

appointmentRoutes.post(
  "/:id/reschedule",
  zValidator("param", z.object({ id: z.string().uuid() })),
  zValidator("json", z.object({ startsAt: z.string().datetime({ offset: true }), note: z.string().trim().max(500).optional() })),
  async (c) => {
    const { id } = c.req.valid("param");
    const { startsAt, note } = c.req.valid("json");
    const next = await rescheduleAppointment(c.get("db"), {
      id,
      newStartsAt: new Date(startsAt),
      note,
      actorStaffId: c.get("staff").id,
    });
    return c.json({ appointment: next }, 201);
  },
);

appointmentRoutes.post(
  "/:id/patient",
  zValidator("param", z.object({ id: z.string().uuid() })),
  zValidator("json", linkPatientSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { patientId } = c.req.valid("json");
    const result = await linkAppointmentToPatient(c.get("db"), id, patientId, c.get("staff").id);
    return c.json(result, result.created ? 201 : 200);
  },
);

appointmentRoutes.post(
  "/:id/reminder",
  zValidator("param", z.object({ id: z.string().uuid() })),
  zValidator("json", z.object({ sent: z.boolean() })),
  async (c) => {
    const { id } = c.req.valid("param");
    const { sent } = c.req.valid("json");
    const appointment = await setReminderSent(c.get("db"), id, sent, c.get("staff").id);
    return c.json({ appointment });
  },
);
