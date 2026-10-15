import { canTransition, type AppointmentStatus } from "@dr-vargas/shared";

export type ActionKey = "confirm" | "reject" | "cancel" | "complete" | "no_show" | "reschedule";

export interface ActionDef {
  key: ActionKey;
  label: string;
  to: AppointmentStatus;
  tone: "primary" | "outline" | "danger";
  /** Acciones que no se pueden deshacer piden confirmacion explicita. */
  confirm?: string;
}

const ALL: ActionDef[] = [
  { key: "confirm", label: "Confirmar", to: "CONFIRMED", tone: "primary" },
  { key: "reschedule", label: "Reagendar", to: "RESCHEDULED", tone: "outline" },
  { key: "complete", label: "Completada", to: "COMPLETED", tone: "outline" },
  { key: "no_show", label: "No asistió", to: "NO_SHOW", tone: "outline", confirm: "Se marcará que la paciente no asistió. Esta acción no se puede deshacer." },
  { key: "reject", label: "Rechazar", to: "REJECTED", tone: "danger", confirm: "Se rechazará esta solicitud. Esta acción no se puede deshacer." },
  { key: "cancel", label: "Cancelar", to: "CANCELLED", tone: "danger", confirm: "Se cancelará esta cita y el horario quedará libre. Esta acción no se puede deshacer." },
];

/** Las acciones disponibles salen de las mismas transiciones validas que aplica el servidor. */
export function actionsFor(status: AppointmentStatus): ActionDef[] {
  return ALL.filter((a) => canTransition(status, a.to));
}
