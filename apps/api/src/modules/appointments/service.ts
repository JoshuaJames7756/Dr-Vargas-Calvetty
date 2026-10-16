import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  canTransition,
  type AppointmentRequestInput,
  type AppointmentStatus,
} from "@dr-vargas/shared";
import type { Db } from "../../db/client";
import { appointments, appointmentStatusHistory, patients, services } from "../../db/schema";
import { audit } from "../../lib/audit";
import { AppError, badRequest, conflict, notFound } from "../../lib/errors";
import { getAvailableSlots, utcToLocal } from "../availability/service";

/** Maximo de solicitudes PENDING simultaneas por telefono (freno anti abuso, ademas de Turnstile). */
const MAX_PENDING_PER_PHONE = 3;

function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

const SLOT_TAKEN = () => conflict("SLOT_TAKEN", "Ese horario ya fue confirmado para otra persona. Elige otro horario.");

/** El paciente solicita. Esto crea una solicitud PENDING, NO una cita confirmada. */
export async function createAppointmentRequest(db: Db, input: AppointmentRequestInput) {
  const startsAt = new Date(input.startsAt);
  const { date, minute } = utcToLocal(startsAt);

  // Re-validacion en el servidor: el horario debe seguir disponible ahora mismo.
  const available = await getAvailableSlots(db, input.serviceId, date);
  const slot = available.slots.find((s) => s.startMinute === minute);
  if (!slot) throw conflict("SLOT_UNAVAILABLE", "Ese horario ya no está disponible. Elige otro.");

  const endsAt = new Date(startsAt.getTime() + (slot.endMinute - slot.startMinute) * 60_000);

  return db.transaction(async (tx) => {
    const [{ pending } = { pending: 0 }] = await tx
      .select({ pending: count() })
      .from(appointments)
      .where(and(eq(appointments.requesterPhone, input.phone), eq(appointments.status, "PENDING")));
    if (pending >= MAX_PENDING_PER_PHONE) {
      throw new AppError(429, "TOO_MANY_PENDING", "Ya tienes solicitudes pendientes. Espera la confirmación o escríbenos por WhatsApp.");
    }

    const [created] = await tx
      .insert(appointments)
      .values({
        serviceId: input.serviceId,
        requesterName: input.fullName,
        requesterPhone: input.phone,
        startsAt,
        endsAt,
        reason: input.reason ?? null,
        status: "PENDING",
      })
      .returning({ id: appointments.id, startsAt: appointments.startsAt, status: appointments.status });
    if (!created) throw new Error("No se pudo crear la solicitud");

    await tx.insert(appointmentStatusHistory).values({ appointmentId: created.id, fromStatus: null, toStatus: "PENDING" });
    await audit(tx, {
      actorType: "public",
      action: "appointment.requested",
      entityType: "appointment",
      entityId: created.id,
    });
    return created;
  });
}

export async function listAppointments(db: Db, opts: { status?: AppointmentStatus; from?: Date; to?: Date; limit?: number }) {
  const conditions = [
    opts.status ? eq(appointments.status, opts.status) : undefined,
    opts.from ? gte(appointments.startsAt, opts.from) : undefined,
    opts.to ? lt(appointments.startsAt, opts.to) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);

  return db
    .select({
      id: appointments.id,
      status: appointments.status,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      requesterName: appointments.requesterName,
      requesterPhone: appointments.requesterPhone,
      reason: appointments.reason,
      patientId: appointments.patientId,
      reminderSentAt: appointments.reminderSentAt,
      version: appointments.version,
      serviceId: appointments.serviceId,
      serviceName: services.name,
      createdAt: appointments.createdAt,
    })
    .from(appointments)
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(opts.status === "PENDING" ? desc(appointments.createdAt) : appointments.startsAt)
    .limit(Math.min(opts.limit ?? 100, 200));
}

interface ChangeStatusArgs {
  id: string;
  to: AppointmentStatus;
  note?: string;
  actorStaffId: string;
}

/** Cambia el estado validando la transicion, con bloqueo de fila y control de version. */
export async function changeAppointmentStatus(db: Db, args: ChangeStatusArgs) {
  if (args.to === "RESCHEDULED") {
    throw badRequest("USE_RESCHEDULE", "Para reagendar usa la acción de reagendar con un nuevo horario.");
  }

  try {
    return await db.transaction(async (tx) => {
      const [appt] = await tx.select().from(appointments).where(eq(appointments.id, args.id)).for("update").limit(1);
      if (!appt) throw notFound("Cita no encontrada");

      if (!canTransition(appt.status, args.to)) {
        throw conflict("INVALID_TRANSITION", `No se puede pasar de ${appt.status} a ${args.to}.`);
      }

      let patientId = appt.patientId;
      if (args.to === "CONFIRMED" && !patientId) {
        patientId = await findOrCreatePatient(tx, appt.requesterName, appt.requesterPhone);
      }

      const [updated] = await tx
        .update(appointments)
        .set({ status: args.to, patientId, version: sql`${appointments.version} + 1`, updatedAt: new Date() })
        .where(eq(appointments.id, args.id))
        .returning();

      await tx.insert(appointmentStatusHistory).values({
        appointmentId: args.id,
        fromStatus: appt.status,
        toStatus: args.to,
        actorStaffId: args.actorStaffId,
        note: args.note ?? null,
      });
      await audit(tx, {
        actorType: "staff",
        actorId: args.actorStaffId,
        action: `appointment.${args.to.toLowerCase()}`,
        entityType: "appointment",
        entityId: args.id,
        metadata: { from: appt.status, to: args.to },
      });
      return updated;
    });
  } catch (err) {
    // Garantia final: la restriccion de exclusion de la base impide dos CONFIRMED solapadas.
    if (pgCode(err) === "23P01") throw SLOT_TAKEN();
    throw err;
  }
}

/** Reagenda: la cita original pasa a RESCHEDULED y se crea una nueva CONFIRMED enlazada. */
export async function rescheduleAppointment(db: Db, args: { id: string; newStartsAt: Date; actorStaffId: string; note?: string }) {
  const { date, minute } = utcToLocal(args.newStartsAt);

  try {
    return await db.transaction(async (tx) => {
      const [appt] = await tx.select().from(appointments).where(eq(appointments.id, args.id)).for("update").limit(1);
      if (!appt) throw notFound("Cita no encontrada");
      if (!canTransition(appt.status, "RESCHEDULED")) {
        throw conflict("INVALID_TRANSITION", `Una cita ${appt.status} no se puede reagendar.`);
      }

      // Re-validar el nuevo horario en el servidor, dentro de la misma transaccion.
      const available = await getAvailableSlots(tx, appt.serviceId, date);
      const slot = available.slots.find((s) => s.startMinute === minute);
      if (!slot) throw conflict("SLOT_UNAVAILABLE", "El nuevo horario no está disponible.");
      const endsAt = new Date(args.newStartsAt.getTime() + (slot.endMinute - slot.startMinute) * 60_000);

      // Liberar el horario original antes de ocupar el nuevo.
      await tx
        .update(appointments)
        .set({ status: "RESCHEDULED", version: sql`${appointments.version} + 1`, updatedAt: new Date() })
        .where(eq(appointments.id, appt.id));

      const [next] = await tx
        .insert(appointments)
        .values({
          serviceId: appt.serviceId,
          patientId: appt.patientId,
          requesterName: appt.requesterName,
          requesterPhone: appt.requesterPhone,
          startsAt: args.newStartsAt,
          endsAt,
          reason: appt.reason,
          status: "CONFIRMED",
        })
        .returning();
      if (!next) throw new Error("No se pudo crear la nueva cita");

      await tx.update(appointments).set({ rescheduledToId: next.id }).where(eq(appointments.id, appt.id));

      await tx.insert(appointmentStatusHistory).values([
        { appointmentId: appt.id, fromStatus: appt.status, toStatus: "RESCHEDULED", actorStaffId: args.actorStaffId, note: args.note ?? null },
        { appointmentId: next.id, fromStatus: null, toStatus: "CONFIRMED", actorStaffId: args.actorStaffId, note: "Reagendada" },
      ]);
      await audit(tx, {
        actorType: "staff",
        actorId: args.actorStaffId,
        action: "appointment.rescheduled",
        entityType: "appointment",
        entityId: appt.id,
        metadata: { newAppointmentId: next.id },
      });
      return next;
    });
  } catch (err) {
    if (pgCode(err) === "23P01") throw SLOT_TAKEN();
    throw err;
  }
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function findOrCreatePatient(tx: Tx, fullName: string, phone: string): Promise<string> {
  const [existing] = await tx
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.phone, phone), sql`lower(${patients.fullName}) = lower(${fullName})`))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await tx.insert(patients).values({ fullName, phone }).returning({ id: patients.id });
  if (!created) throw new Error("No se pudo crear el paciente");
  return created.id;
}

/** Marca (o desmarca) que el recordatorio por WhatsApp ya se envio. Solo aplica a citas confirmadas. */
export async function setReminderSent(db: Db, id: string, sent: boolean, actorStaffId: string) {
  return db.transaction(async (tx) => {
    const [appt] = await tx.select({ status: appointments.status }).from(appointments).where(eq(appointments.id, id)).for("update").limit(1);
    if (!appt) throw notFound("Cita no encontrada");
    if (appt.status !== "CONFIRMED") throw conflict("NOT_CONFIRMED", "Solo se registran recordatorios de citas confirmadas.");

    const [updated] = await tx
      .update(appointments)
      .set({ reminderSentAt: sent ? new Date() : null })
      .where(eq(appointments.id, id))
      .returning({ id: appointments.id, reminderSentAt: appointments.reminderSentAt });
    await audit(tx, {
      actorType: "staff",
      actorId: actorStaffId,
      action: sent ? "appointment.reminder_marked_sent" : "appointment.reminder_unmarked",
      entityType: "appointment",
      entityId: id,
    });
    return updated;
  });
}
