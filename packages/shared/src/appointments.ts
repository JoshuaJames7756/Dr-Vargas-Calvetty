import { z } from "zod";

export const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
  "RESCHEDULED",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/**
 * Transiciones validas. Cualquier otra se rechaza en el servidor.
 * - PENDING: solicitud del paciente, aun no es una cita.
 * - RESCHEDULED es un estado final de la cita original; la nueva cita se crea como CONFIRMED.
 */
export const ALLOWED_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["CANCELLED", "COMPLETED", "NO_SHOW", "RESCHEDULED"],
  REJECTED: [],
  CANCELLED: [],
  COMPLETED: [],
  NO_SHOW: [],
  RESCHEDULED: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Estados que ocupan el horario (los unicos protegidos por la restriccion anti doble reserva). */
export const SLOT_BLOCKING_STATUSES: readonly AppointmentStatus[] = ["CONFIRMED"];

// ---------- Esquemas de entrada ----------

const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-().]/g, ""))
  .pipe(z.string().regex(/^(\+?591)?[67]\d{7}$|^[24]\d{6,7}$/, "Ingresa un número de teléfono boliviano válido"));

export const appointmentRequestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Escribe tu nombre completo")
    .max(120, "El nombre es demasiado largo"),
  phone: phoneSchema,
  serviceId: z.string().uuid("Servicio inválido"),
  /** Inicio preferido en ISO 8601 con zona horaria (UTC). */
  startsAt: z.string().datetime({ offset: true }),
  /** Motivo breve y opcional. No pedir diagnosticos ni informacion clinica detallada. */
  reason: z.string().trim().max(280, "Máximo 280 caracteres").optional(),
  /** Token de Cloudflare Turnstile. */
  turnstileToken: z.string().min(1, "Verificación requerida"),
  /** Consentimiento explicito para tratar los datos de contacto. */
  consent: z.literal(true, { error: "Debes aceptar para continuar" }),
});

export type AppointmentRequestInput = z.infer<typeof appointmentRequestSchema>;

export const availabilityQuerySchema = z.object({
  serviceId: z.string().uuid(),
  /** Fecha local del consultorio, formato YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});

export const changeStatusSchema = z.object({
  to: z.enum(APPOINTMENT_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export const contactMessageSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  phone: phoneSchema,
  message: z.string().trim().min(5).max(1000),
  turnstileToken: z.string().min(1),
  consent: z.literal(true),
});
