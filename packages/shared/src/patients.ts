import { z } from "zod";
import { phoneSchema } from "./appointments";

/** Datos administrativos del paciente. Lo clinico vive en las notas, que solo ve el doctor. */
export const patientInputSchema = z.object({
  fullName: z.string().trim().min(3, "Escribe el nombre completo").max(120, "El nombre es demasiado largo"),
  phone: phoneSchema,
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Fecha inválida")
    .refine((v) => v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10), "La fecha de nacimiento no es válida")
    .nullable()
    .optional(),
  email: z.string().trim().toLowerCase().email("Correo inválido").max(160).nullable().optional(),
});
export type PatientInput = z.infer<typeof patientInputSchema>;

export const patientNoteSchema = z.object({
  body: z.string().trim().min(1, "Escribe la nota").max(10_000, "La nota es demasiado larga"),
  appointmentId: z.string().uuid().optional(),
  /** Si se indica, esta nota corrige a otra. Las notas originales nunca se modifican ni se borran. */
  amendsId: z.string().uuid().optional(),
});
export type PatientNoteInput = z.infer<typeof patientNoteSchema>;

export const patientSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});

/** Vincula una cita a un paciente existente, o crea uno nuevo con los datos de la solicitud si no se indica. */
export const linkPatientSchema = z.object({ patientId: z.string().uuid().optional() });
