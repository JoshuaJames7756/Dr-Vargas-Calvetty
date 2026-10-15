import type { AppointmentStatus } from "@dr-vargas/shared";

// El estado nunca se comunica solo con color: siempre lleva texto.
const MAP: Record<AppointmentStatus, { label: string; cls: string }> = {
  PENDING: { label: "Pendiente", cls: "bg-amber-100 text-amber-800" },
  CONFIRMED: { label: "Confirmada", cls: "bg-teal-100 text-teal-900" },
  REJECTED: { label: "Rechazada", cls: "bg-rose-100 text-rose-500" },
  CANCELLED: { label: "Cancelada", cls: "bg-rose-100 text-rose-500" },
  COMPLETED: { label: "Completada", cls: "bg-sand text-ink-soft" },
  NO_SHOW: { label: "No asistió", cls: "bg-sand text-ink-soft" },
  RESCHEDULED: { label: "Reagendada", cls: "bg-sand text-ink-soft" },
};

export const statusLabel = (s: AppointmentStatus) => MAP[s].label;

export default function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { label, cls } = MAP[status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{label}</span>;
}
