import { and, eq, gt, lt } from "drizzle-orm";
import { computeSlots, localToUtc, type Slot } from "@dr-vargas/shared";
import type { Db } from "../../db/client";
import {
  appointments,
  availabilityBreaks,
  availabilityExceptions,
  availabilityRules,
  services,
} from "../../db/schema";
import { badRequest, notFound } from "../../lib/errors";

/** Bolivia: UTC-4 fijo, sin horario de verano. */
export const CLINIC_OFFSET_MINUTES = -4 * 60;
/** Anticipacion minima para solicitar una cita. */
export const MIN_LEAD_MINUTES = 120;
/** Maximo de dias hacia adelante que se puede solicitar. */
export const MAX_DAYS_AHEAD = 90;

export function localNow(now = new Date()): { date: string; minute: number } {
  const local = new Date(now.getTime() + CLINIC_OFFSET_MINUTES * 60_000);
  const date = local.toISOString().slice(0, 10);
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  return { date, minute };
}

/** Convierte un instante UTC a fecha y minuto locales del consultorio. */
export function utcToLocal(instant: Date): { date: string; minute: number } {
  return localNow(instant);
}

export interface SlotsResult {
  service: { id: string; name: string; durationMinutes: number };
  date: string;
  slots: Slot[];
}

export async function getAvailableSlots(db: Pick<Db, "select">, serviceId: string, date: string): Promise<SlotsResult> {
  const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
  if (!service || !service.bookable) throw notFound("Servicio no disponible");

  const now = localNow();
  if (date < now.date) throw badRequest("PAST_DATE", "Esa fecha ya pasó");
  const maxDate = localNow(new Date(Date.now() + MAX_DAYS_AHEAD * 86_400_000)).date;
  if (date > maxDate) throw badRequest("TOO_FAR", "Solo se pueden solicitar citas con hasta 90 días de anticipación");

  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();

  const [rules, breaks, exceptions] = await Promise.all([
    db.select().from(availabilityRules).where(and(eq(availabilityRules.weekday, weekday), eq(availabilityRules.active, true))),
    db.select().from(availabilityBreaks).where(eq(availabilityBreaks.weekday, weekday)),
    db.select().from(availabilityExceptions).where(eq(availabilityExceptions.date, date)).limit(1),
  ]);

  const dayStart = localToUtc(date, 0, CLINIC_OFFSET_MINUTES);
  const dayEnd = localToUtc(date, 24 * 60, CLINIC_OFFSET_MINUTES);

  // Solo las citas CONFIRMED ocupan horario.
  const confirmed = await db
    .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
    .from(appointments)
    .where(and(eq(appointments.status, "CONFIRMED"), lt(appointments.startsAt, dayEnd), gt(appointments.endsAt, dayStart)));

  const busy = confirmed.map((a) => ({
    startMinute: Math.round((a.startsAt.getTime() - dayStart.getTime()) / 60_000),
    endMinute: Math.round((a.endsAt.getTime() - dayStart.getTime()) / 60_000),
  }));

  const ex = exceptions[0];
  const slots = computeSlots({
    date,
    rules: rules.map((r) => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute, slotMinutes: r.slotMinutes })),
    breaks: breaks.map((b) => ({ startMinute: b.startMinute, endMinute: b.endMinute })),
    exception: ex
      ? {
          date: ex.date,
          blocked: ex.blocked,
          ranges:
            !ex.blocked && ex.startMinute != null && ex.endMinute != null && ex.slotMinutes != null
              ? [{ startMinute: ex.startMinute, endMinute: ex.endMinute, slotMinutes: ex.slotMinutes }]
              : undefined,
        }
      : undefined,
    busy,
    serviceMinutes: service.durationMinutes,
    nowMinute: date === now.date ? now.minute : undefined,
    minLeadMinutes: MIN_LEAD_MINUTES,
  });

  return {
    service: { id: service.id, name: service.name, durationMinutes: service.durationMinutes },
    date,
    slots,
  };
}
