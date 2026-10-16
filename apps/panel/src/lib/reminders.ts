import { CLINIC } from "@dr-vargas/shared";
import { fmtDay, fmtTime } from "./time";

/** Texto del recordatorio. Solo se abre en WhatsApp: el personal decide si lo envia. */
export function reminderText(a: { requesterName: string; serviceName: string; startsAt: string }): string {
  return `Hola ${a.requesterName}, le recordamos su cita de ${a.serviceName} con el ${CLINIC.doctorName} el ${fmtDay(a.startsAt)} a las ${fmtTime(a.startsAt)}. Consultorio: ${CLINIC.address.line1}, ${CLINIC.address.line2}. Si no puede asistir, por favor avísenos para liberar el horario.`;
}

/** Cuenta cuantas citas ya tienen recordatorio marcado. */
export function reminderProgress(list: { reminderSentAt: string | null }[]): { done: number; total: number } {
  return { done: list.filter((a) => a.reminderSentAt).length, total: list.length };
}
