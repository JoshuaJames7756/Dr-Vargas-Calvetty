import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigserial,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { APPOINTMENT_STATUSES } from "@dr-vargas/shared";

/**
 * Esquema de la primera entrega (Fases 1 a 3).
 * Datos administrativos solamente. La informacion clinica vivira en tablas separadas (Fase 4).
 *
 * La restriccion anti doble reserva (EXCLUDE USING gist) no se puede expresar en Drizzle;
 * vive en la migracion SQL personalizada `drizzle/0001_constraints.sql`.
 */

export const appointmentStatus = pgEnum("appointment_status", APPOINTMENT_STATUSES);
export const staffRole = pgEnum("staff_role", ["doctor", "assistant"]);

export const staffUsers = pgTable("staff_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** ID de usuario de Clerk. La identidad la verifica Clerk; el rol lo decide esta tabla. */
  clerkUserId: text("clerk_user_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: staffRole("role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** Agrupacion publica: ginecologia, oncologia, mastologia. */
  specialty: text("specialty").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  /** Solo los servicios activos se pueden solicitar. */
  bookable: boolean("bookable").notNull().default(true),
  /** Visible en el sitio publico. */
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 0 = domingo ... 6 = sabado */
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    slotMinutes: integer("slot_minutes").notNull().default(30),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    check("availability_rules_weekday", sql`${t.weekday} between 0 and 6`),
    check("availability_rules_range", sql`${t.startMinute} >= 0 and ${t.endMinute} <= 1440 and ${t.startMinute} < ${t.endMinute}`),
    check("availability_rules_slot", sql`${t.slotMinutes} > 0`),
  ],
);

export const availabilityBreaks = pgTable(
  "availability_breaks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (t) => [
    check("availability_breaks_weekday", sql`${t.weekday} between 0 and 6`),
    check("availability_breaks_range", sql`${t.startMinute} >= 0 and ${t.endMinute} <= 1440 and ${t.startMinute} < ${t.endMinute}`),
  ],
);

export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Fecha local del consultorio. */
    date: date("date", { mode: "string" }).notNull(),
    blocked: boolean("blocked").notNull().default(true),
    /** Si no esta bloqueado, horario alternativo para ese dia. */
    startMinute: integer("start_minute"),
    endMinute: integer("end_minute"),
    slotMinutes: integer("slot_minutes"),
    note: text("note"),
  },
  (t) => [uniqueIndex("availability_exceptions_date_idx").on(t.date)],
);

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    birthDate: date("birth_date", { mode: "string" }),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("patients_phone_idx").on(t.phone), index("patients_name_idx").on(t.fullName)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    /** Se vincula al confirmar. Una solicitud publica NO crea pacientes (evita basura por spam). */
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }),
    requesterName: text("requester_name").notNull(),
    requesterPhone: text("requester_phone").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatus("status").notNull().default("PENDING"),
    /** Motivo breve opcional. Informacion minima; no diagnosticos. */
    reason: text("reason"),
    rescheduledToId: uuid("rescheduled_to_id"),
    /** Cuando el personal marco que ya envio el recordatorio por WhatsApp. null = sin recordar. */
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    /** Control de concurrencia optimista. */
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("appointments_time_order", sql`${t.endsAt} > ${t.startsAt}`),
    index("appointments_starts_at_idx").on(t.startsAt),
    index("appointments_status_idx").on(t.status),
    index("appointments_patient_idx").on(t.patientId),
  ],
);

export const appointmentStatusHistory = pgTable(
  "appointment_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "restrict" }),
    fromStatus: appointmentStatus("from_status"),
    toStatus: appointmentStatus("to_status").notNull(),
    actorStaffId: uuid("actor_staff_id").references(() => staffUsers.id, { onDelete: "restrict" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("appointment_history_appt_idx").on(t.appointmentId)],
);

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  message: text("message").notNull(),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Registro de auditoria: solo insercion.
 * La migracion 0001 revoca UPDATE y DELETE al rol de la aplicacion y agrega un trigger de proteccion.
 * NO guardar diagnosticos, notas clinicas ni contenido de documentos en `metadata`.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => [index("audit_log_at_idx").on(t.at), index("audit_log_entity_idx").on(t.entityType, t.entityId)],
);

/**
 * Notas clinicas. Solo las ve y escribe el doctor. Son de solo insercion: una correccion es una nota nueva
 * que apunta a la anterior (amends_id). Un trigger impide modificar o borrar (ver migracion 0002).
 */
export const patientNotes = pgTable(
  "patient_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "restrict" }),
    authorStaffId: uuid("author_staff_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    amendsId: uuid("amends_id").references((): AnyPgColumn => patientNotes.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("patient_notes_body_length", sql`char_length(${t.body}) between 1 and 10000`),
    index("patient_notes_patient_idx").on(t.patientId, t.createdAt),
  ],
);

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Documentos de pacientes (estudios, recetas). Solo el doctor los ve. Los metadatos van aqui y el contenido en
 * patient_document_files, para que listar documentos nunca lea los archivos.
 * No se borran: "eliminar" los oculta (deleted_at). Un trigger impide borrar filas o cambiar el contenido (migracion 0004).
 */
export const patientDocuments = pgTable(
  "patient_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    uploadedByStaffId: uuid("uploaded_by_staff_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByStaffId: uuid("deleted_by_staff_id").references(() => staffUsers.id, { onDelete: "restrict" }),
  },
  (t) => [
    check("patient_documents_title_length", sql`char_length(${t.title}) between 1 and 120`),
    check("patient_documents_size", sql`${t.sizeBytes} between 1 and 2097152`),
    check("patient_documents_mime", sql`${t.mimeType} in ('application/pdf','image/jpeg','image/png','image/webp')`),
    check("patient_documents_deleted_pair", sql`(${t.deletedAt} is null) = (${t.deletedByStaffId} is null)`),
    index("patient_documents_patient_idx").on(t.patientId, t.createdAt),
  ],
);

export const patientDocumentFiles = pgTable("patient_document_files", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => patientDocuments.id, { onDelete: "restrict" }),
  content: bytea("content").notNull(),
});
