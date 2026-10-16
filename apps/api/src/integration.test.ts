/**
 * Pruebas de integracion contra un PostgreSQL REAL (restricciones, triggers y transacciones).
 * Se saltan solas si no hay TEST_DATABASE_URL.
 *
 * IMPORTANTE: usar una base VACIA de pruebas con las migraciones aplicadas, nunca la de produccion.
 * Dejan datos (el historial y las notas son inmutables a proposito).
 *
 *   TEST_DATABASE_URL="postgresql://..." pnpm --filter @dr-vargas/api test
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "./db/client";
import * as schema from "./db/schema";
import { AppError } from "./lib/errors";
import { changeAppointmentStatus } from "./modules/appointments/service";
import { addNote, linkAppointmentToPatient, listNotes, searchPatients } from "./modules/patients/service";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("integracion con PostgreSQL real", () => {
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema }) as unknown as Db;
  const run = Date.now().toString().slice(-6);
  let staffId = "";
  let serviceId = "";

  beforeAll(async () => {
    const [s] = await db.insert(schema.staffUsers).values({ clerkUserId: `user_it_${run}`, displayName: "Doctor IT", role: "doctor" }).returning({ id: schema.staffUsers.id });
    staffId = s!.id;
    const [sv] = await db.insert(schema.services).values({ slug: `it-${run}`, name: "Servicio IT", specialty: "ginecologia" }).returning({ id: schema.services.id });
    serviceId = sv!.id;
  });
  afterAll(async () => pool.end());

  const mkAppt = async (startIso: string, status: "PENDING" | "CONFIRMED", phone = "70011111", name = "Paciente IT") => {
    const start = new Date(startIso);
    const [a] = await db
      .insert(schema.appointments)
      .values({ serviceId, requesterName: name, requesterPhone: phone, startsAt: start, endsAt: new Date(start.getTime() + 30 * 60_000), status })
      .returning({ id: schema.appointments.id });
    return a!.id;
  };
  const code = async (p: Promise<unknown>) => {
    try {
      await p;
      return null;
    } catch (e) {
      return e instanceof AppError ? e.code : (e as Error).message;
    }
  };

  it("confirmar dos solicitudes del mismo horario: la segunda falla con SLOT_TAKEN", async () => {
    const a = await mkAppt("2031-03-03T14:00:00Z", "PENDING");
    const b = await mkAppt("2031-03-03T14:15:00Z", "PENDING", "70022222");
    await changeAppointmentStatus(db, { id: a, to: "CONFIRMED", actorStaffId: staffId });
    expect(await code(changeAppointmentStatus(db, { id: b, to: "CONFIRMED", actorStaffId: staffId }))).toBe("SLOT_TAKEN");
    const [row] = await db.select({ status: schema.appointments.status }).from(schema.appointments).where(eq(schema.appointments.id, b));
    expect(row!.status).toBe("PENDING");
  });

  it("dos confirmaciones simultaneas del mismo horario: solo una gana", async () => {
    const a = await mkAppt("2031-03-04T14:00:00Z", "PENDING", "70033333");
    const b = await mkAppt("2031-03-04T14:00:00Z", "PENDING", "70044444");
    const results = await Promise.all([
      code(changeAppointmentStatus(db, { id: a, to: "CONFIRMED", actorStaffId: staffId })),
      code(changeAppointmentStatus(db, { id: b, to: "CONFIRMED", actorStaffId: staffId })),
    ]);
    expect(results.filter((r) => r === null)).toHaveLength(1);
    expect(results.filter((r) => r === "SLOT_TAKEN")).toHaveLength(1);
  });

  it("una solicitud pendiente no se puede vincular a un paciente", async () => {
    const a = await mkAppt("2031-03-05T14:00:00Z", "PENDING", "70055555");
    expect(await code(linkAppointmentToPatient(db, a, undefined, staffId))).toBe("APPOINTMENT_NOT_CONFIRMED");
  });

  it("vincular crea el paciente y reutiliza el existente aunque el telefono tenga otro formato", async () => {
    const first = await mkAppt("2031-03-06T14:00:00Z", "CONFIRMED", "+59170066666", "Ana Prueba");
    const second = await mkAppt("2031-03-07T14:00:00Z", "CONFIRMED", "70066666", "Ana Prueba");
    const r1 = await linkAppointmentToPatient(db, first, undefined, staffId);
    const r2 = await linkAppointmentToPatient(db, second, undefined, staffId);
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(false);
    expect(r2.patientId).toBe(r1.patientId);
    expect(await code(linkAppointmentToPatient(db, first, undefined, staffId))).toBe("ALREADY_LINKED");
  });

  it("la busqueda no interpreta comodines como patron", async () => {
    const found = await searchPatients(db, { q: "%" });
    expect(found.patients.every((p) => p.fullName.includes("%") || p.phone.includes("%"))).toBe(true);
  });

  it("notas: corregir crea una nota nueva, la original queda marcada y no se puede modificar ni borrar", async () => {
    const apptId = await mkAppt("2031-03-08T14:00:00Z", "CONFIRMED", "70077777", "Beatriz Prueba");
    const { patientId } = await linkAppointmentToPatient(db, apptId, undefined, staffId);

    const n1 = await addNote(db, patientId, { body: "Primera nota", appointmentId: apptId }, staffId);
    const n2 = await addNote(db, patientId, { body: "Nota corregida", amendsId: n1.id }, staffId);
    expect(await code(addNote(db, patientId, { body: "Otra correccion", amendsId: n1.id }, staffId))).toBe("ALREADY_AMENDED");

    const notes = await listNotes(db, patientId, staffId);
    expect(notes).toHaveLength(2);
    expect(notes.find((n) => n.id === n1.id)!.superseded).toBe(true);
    expect(notes.find((n) => n.id === n2.id)!.superseded).toBe(false);

    expect(await code(Promise.resolve(db.update(schema.patientNotes).set({ body: "alterada" }).where(eq(schema.patientNotes.id, n1.id)).then(() => null)))).not.toBeNull();
    expect(await code(Promise.resolve(db.delete(schema.patientNotes).where(eq(schema.patientNotes.id, n1.id)).then(() => null)))).not.toBeNull();
  });

  it("notas: no se puede asociar una cita de otro paciente ni corregir una nota ajena", async () => {
    const a1 = await mkAppt("2031-03-09T14:00:00Z", "CONFIRMED", "70088888", "Carla Prueba");
    const a2 = await mkAppt("2031-03-10T14:00:00Z", "CONFIRMED", "70099999", "Diana Prueba");
    const p1 = (await linkAppointmentToPatient(db, a1, undefined, staffId)).patientId;
    const p2 = (await linkAppointmentToPatient(db, a2, undefined, staffId)).patientId;
    expect(await code(addNote(db, p1, { body: "x", appointmentId: a2 }, staffId))).toBe("APPOINTMENT_MISMATCH");
    const n = await addNote(db, p2, { body: "de Diana" }, staffId);
    expect(await code(addNote(db, p1, { body: "x", amendsId: n.id }, staffId))).toBe("AMEND_MISMATCH");
  });

  it("leer notas deja registro de auditoria SIN copiar el contenido", async () => {
    const a = await mkAppt("2031-03-11T14:00:00Z", "CONFIRMED", "70010101", "Elena Prueba");
    const { patientId } = await linkAppointmentToPatient(db, a, undefined, staffId);
    await addNote(db, patientId, { body: "CONTENIDO-SECRETO-XYZ" }, staffId);
    await listNotes(db, patientId, staffId);
    const logs = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, patientId));
    expect(logs.some((l) => l.action === "patient.notes.read")).toBe(true);
    expect(JSON.stringify(logs)).not.toContain("CONTENIDO-SECRETO-XYZ");
  });
});
