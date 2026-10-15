import { zValidator } from "@hono/zod-validator";
import { asc, eq, gte } from "drizzle-orm";
import { Hono } from "hono";
import { dateParamSchema, exceptionSchema, weeklyScheduleSchema } from "@dr-vargas/shared";
import { availabilityBreaks, availabilityExceptions, availabilityRules } from "../db/schema";
import type { AppEnv } from "../env";
import { audit } from "../lib/audit";
import { requireRole } from "../middleware/auth";
import { localNow } from "../modules/availability/service";

/** Rutas privadas de disponibilidad. requireStaff se aplica al montar (index.ts). Solo el doctor modifica. */
export const availabilityRoutes = new Hono<AppEnv>();

availabilityRoutes.get("/", async (c) => {
  const db = c.get("db");
  const today = localNow().date;
  const [rules, breaks, exceptions] = await Promise.all([
    db.select().from(availabilityRules).where(eq(availabilityRules.active, true)).orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startMinute)),
    db.select().from(availabilityBreaks).orderBy(asc(availabilityBreaks.weekday), asc(availabilityBreaks.startMinute)),
    db.select().from(availabilityExceptions).where(gte(availabilityExceptions.date, today)).orderBy(asc(availabilityExceptions.date)),
  ]);

  // Se devuelve agrupado por dia de la semana, listo para el editor.
  const days = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    ranges: rules.filter((r) => r.weekday === weekday).map((r) => ({ startMinute: r.startMinute, endMinute: r.endMinute, slotMinutes: r.slotMinutes })),
    breaks: breaks.filter((b) => b.weekday === weekday).map((b) => ({ startMinute: b.startMinute, endMinute: b.endMinute })),
  }));
  return c.json({ days, exceptions });
});

// Reemplaza el horario semanal completo de forma atomica.
availabilityRoutes.put("/weekly", requireRole("doctor"), zValidator("json", weeklyScheduleSchema), async (c) => {
  const { days } = c.req.valid("json");
  const db = c.get("db");

  await db.transaction(async (tx) => {
    await tx.delete(availabilityRules);
    await tx.delete(availabilityBreaks);

    const ruleRows = days.flatMap((d) => d.ranges.map((r) => ({ weekday: d.weekday, ...r })));
    const breakRows = days.flatMap((d) => d.breaks.map((b) => ({ weekday: d.weekday, ...b })));
    if (ruleRows.length) await tx.insert(availabilityRules).values(ruleRows);
    if (breakRows.length) await tx.insert(availabilityBreaks).values(breakRows);

    await audit(tx, {
      actorType: "staff",
      actorId: c.get("staff").id,
      action: "availability.weekly_updated",
      entityType: "availability",
      metadata: { ranges: ruleRows.length, breaks: breakRows.length },
    });
  });
  return c.json({ ok: true });
});

availabilityRoutes.put("/exceptions/:date", requireRole("doctor"), zValidator("param", dateParamSchema), zValidator("json", exceptionSchema), async (c) => {
  const { date } = c.req.valid("param");
  const e = c.req.valid("json");
  const db = c.get("db");

  const values = {
    date,
    blocked: e.blocked,
    startMinute: e.blocked ? null : (e.startMinute ?? null),
    endMinute: e.blocked ? null : (e.endMinute ?? null),
    slotMinutes: e.blocked ? null : (e.slotMinutes ?? null),
    note: e.note ?? null,
  };
  await db.transaction(async (tx) => {
    await tx.insert(availabilityExceptions).values(values).onConflictDoUpdate({ target: availabilityExceptions.date, set: values });
    await audit(tx, { actorType: "staff", actorId: c.get("staff").id, action: "availability.exception_set", entityType: "availability_exception", entityId: date, metadata: { blocked: e.blocked } });
  });
  return c.json({ ok: true });
});

availabilityRoutes.delete("/exceptions/:date", requireRole("doctor"), zValidator("param", dateParamSchema), async (c) => {
  const { date } = c.req.valid("param");
  const db = c.get("db");
  await db.transaction(async (tx) => {
    await tx.delete(availabilityExceptions).where(eq(availabilityExceptions.date, date));
    await audit(tx, { actorType: "staff", actorId: c.get("staff").id, action: "availability.exception_removed", entityType: "availability_exception", entityId: date });
  });
  return c.json({ ok: true });
});
