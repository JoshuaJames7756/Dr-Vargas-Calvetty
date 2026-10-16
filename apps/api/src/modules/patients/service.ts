import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import type { PatientInput, PatientNoteInput } from "@dr-vargas/shared";
import type { Db } from "../../db/client";
import { appointments, patientNotes, patients, services, staffUsers } from "../../db/schema";
import { audit } from "../../lib/audit";
import { badRequest, conflict, notFound } from "../../lib/errors";

/** Escapa los comodines de LIKE para que una busqueda como "50%" no se interprete como patron. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** Normaliza para comparar telefonos: solo digitos, sin el prefijo 591. */
export const phoneKey = (p: string) => p.replace(/\D/g, "").replace(/^591/, "");

const patientColumns = {
  id: patients.id,
  fullName: patients.fullName,
  phone: patients.phone,
  birthDate: patients.birthDate,
  email: patients.email,
  createdAt: patients.createdAt,
};

export async function searchPatients(db: Db, opts: { q?: string; limit?: number; offset?: number }) {
  const q = opts.q?.trim();
  const where = q
    ? or(ilike(patients.fullName, `%${escapeLike(q)}%`), ilike(patients.phone, `%${escapeLike(q.replace(/[\s\-()+]/g, ""))}%`))
    : undefined;
  const limit = Math.min(opts.limit ?? 20, 50);
  const rows = await db
    .select(patientColumns)
    .from(patients)
    .where(where)
    .orderBy(asc(patients.fullName))
    .limit(limit + 1)
    .offset(opts.offset ?? 0);
  // Se pide uno de mas para saber si hay otra pagina sin contar toda la tabla.
  return { patients: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function getPatient(db: Db, id: string) {
  const [patient] = await db.select(patientColumns).from(patients).where(eq(patients.id, id)).limit(1);
  if (!patient) throw notFound("Paciente no encontrado");

  const history = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      reason: appointments.reason,
      serviceName: services.name,
    })
    .from(appointments)
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .where(eq(appointments.patientId, id))
    .orderBy(desc(appointments.startsAt))
    .limit(100);

  return { patient, appointments: history };
}

export async function createPatient(db: Db, input: PatientInput, actorStaffId: string) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(patients)
      .values({ fullName: input.fullName, phone: input.phone, birthDate: input.birthDate ?? null, email: input.email ?? null })
      .returning(patientColumns);
    if (!created) throw new Error("No se pudo crear el paciente");
    await audit(tx, { actorType: "staff", actorId: actorStaffId, action: "patient.created", entityType: "patient", entityId: created.id });
    return created;
  });
}

export async function updatePatient(db: Db, id: string, input: PatientInput, actorStaffId: string) {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(patients)
      .set({ fullName: input.fullName, phone: input.phone, birthDate: input.birthDate ?? null, email: input.email ?? null, updatedAt: new Date() })
      .where(eq(patients.id, id))
      .returning(patientColumns);
    if (!updated) throw notFound("Paciente no encontrado");
    // Solo se registra QUE se edito, no los valores.
    await audit(tx, { actorType: "staff", actorId: actorStaffId, action: "patient.updated", entityType: "patient", entityId: id });
    return updated;
  });
}

/**
 * Vincula una cita a un paciente. Sin patientId: reutiliza un paciente con el mismo telefono si existe,
 * o crea uno nuevo con los datos de la solicitud. Solo citas CONFIRMED o COMPLETED (una solicitud
 * pendiente no crea pacientes: evita basura por spam).
 */
export async function linkAppointmentToPatient(db: Db, appointmentId: string, patientId: string | undefined, actorStaffId: string) {
  return db.transaction(async (tx) => {
    const [appt] = await tx.select().from(appointments).where(eq(appointments.id, appointmentId)).for("update").limit(1);
    if (!appt) throw notFound("Cita no encontrada");
    if (appt.status !== "CONFIRMED" && appt.status !== "COMPLETED") {
      throw badRequest("APPOINTMENT_NOT_CONFIRMED", "Solo se puede vincular una cita confirmada o completada.");
    }
    if (appt.patientId) throw conflict("ALREADY_LINKED", "Esta cita ya está vinculada a un paciente.");

    let targetId = patientId;
    let created = false;
    if (targetId) {
      const [p] = await tx.select({ id: patients.id }).from(patients).where(eq(patients.id, targetId)).limit(1);
      if (!p) throw notFound("Paciente no encontrado");
    } else {
      const key = phoneKey(appt.requesterPhone);
      const candidates = await tx.select({ id: patients.id, phone: patients.phone }).from(patients).where(ilike(patients.phone, `%${escapeLike(key)}`));
      const match = candidates.find((c) => phoneKey(c.phone) === key);
      if (match) {
        targetId = match.id;
      } else {
        const [np] = await tx.insert(patients).values({ fullName: appt.requesterName, phone: appt.requesterPhone }).returning({ id: patients.id });
        if (!np) throw new Error("No se pudo crear el paciente");
        targetId = np.id;
        created = true;
      }
    }

    await tx.update(appointments).set({ patientId: targetId, updatedAt: new Date() }).where(eq(appointments.id, appointmentId));
    await audit(tx, {
      actorType: "staff",
      actorId: actorStaffId,
      action: created ? "patient.created_from_appointment" : "appointment.linked_to_patient",
      entityType: "appointment",
      entityId: appointmentId,
      metadata: { patientId: targetId },
    });
    return { patientId: targetId, created };
  });
}

/** Lectura de notas clinicas. SIEMPRE deja constancia de quien las abrio (sin copiar el contenido al registro). */
export async function listNotes(db: Db, patientId: string, actorStaffId: string) {
  const [p] = await db.select({ id: patients.id }).from(patients).where(eq(patients.id, patientId)).limit(1);
  if (!p) throw notFound("Paciente no encontrado");

  const rows = await db
    .select({
      id: patientNotes.id,
      body: patientNotes.body,
      appointmentId: patientNotes.appointmentId,
      amendsId: patientNotes.amendsId,
      createdAt: patientNotes.createdAt,
      authorName: staffUsers.displayName,
    })
    .from(patientNotes)
    .innerJoin(staffUsers, eq(patientNotes.authorStaffId, staffUsers.id))
    .where(eq(patientNotes.patientId, patientId))
    .orderBy(desc(patientNotes.createdAt))
    .limit(500);

  await audit(db, { actorType: "staff", actorId: actorStaffId, action: "patient.notes.read", entityType: "patient", entityId: patientId, metadata: { count: rows.length } });

  // Una nota corregida se marca; la original sigue existiendo y visible en el historial.
  const amended = new Set(rows.map((r) => r.amendsId).filter((x): x is string => !!x));
  return rows.map((r) => ({ ...r, superseded: amended.has(r.id) }));
}

export async function addNote(db: Db, patientId: string, input: PatientNoteInput, actorStaffId: string) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select({ id: patients.id }).from(patients).where(eq(patients.id, patientId)).limit(1);
    if (!p) throw notFound("Paciente no encontrado");

    if (input.appointmentId) {
      const [a] = await tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(eq(appointments.id, input.appointmentId), eq(appointments.patientId, patientId)))
        .limit(1);
      if (!a) throw badRequest("APPOINTMENT_MISMATCH", "Esa cita no pertenece a este paciente.");
    }
    if (input.amendsId) {
      const [orig] = await tx
        .select({ id: patientNotes.id })
        .from(patientNotes)
        .where(and(eq(patientNotes.id, input.amendsId), eq(patientNotes.patientId, patientId)))
        .limit(1);
      if (!orig) throw badRequest("AMEND_MISMATCH", "La nota a corregir no pertenece a este paciente.");
      // Una nota solo se corrige una vez; las siguientes correcciones apuntan a la mas reciente.
      const [already] = await tx.select({ id: patientNotes.id }).from(patientNotes).where(eq(patientNotes.amendsId, input.amendsId)).limit(1);
      if (already) throw conflict("ALREADY_AMENDED", "Esa nota ya fue corregida. Corrige la versión más reciente.");
    }

    const [note] = await tx
      .insert(patientNotes)
      .values({ patientId, authorStaffId: actorStaffId, body: input.body, appointmentId: input.appointmentId ?? null, amendsId: input.amendsId ?? null })
      .returning({ id: patientNotes.id, createdAt: patientNotes.createdAt });
    if (!note) throw new Error("No se pudo guardar la nota");

    await audit(tx, {
      actorType: "staff",
      actorId: actorStaffId,
      action: input.amendsId ? "patient.note.amended" : "patient.note.created",
      entityType: "patient",
      entityId: patientId,
      metadata: { noteId: note.id },
    });
    return note;
  });
}

