import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AppointmentStatus } from "@dr-vargas/shared";
import { ApiError, useApi } from "./api";

const SUCCESS: Partial<Record<AppointmentStatus, string>> = {
  CONFIRMED: "Cita confirmada",
  REJECTED: "Solicitud rechazada",
  CANCELLED: "Cita cancelada",
  COMPLETED: "Cita marcada como completada",
  NO_SHOW: "Marcada como no asistió",
};

/** Acciones sobre citas. Solo se muestra "confirmada" cuando el servidor respondio que la operacion se completo. */
export function useAppointmentActions() {
  const api = useApi();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["appointments"] });

  const onError = (err: unknown) => {
    toast.error(err instanceof ApiError ? err.message : "No se pudo completar la acción.");
    // Si otro cambio ocurrio mientras tanto (por ejemplo horario ocupado), se recarga el estado real.
    refresh();
  };

  const changeStatus = useMutation({
    mutationFn: (v: { id: string; to: AppointmentStatus; note?: string }) => api.changeStatus(v.id, v.to, v.note),
    onSuccess: (_d, v) => {
      toast.success(SUCCESS[v.to] ?? "Estado actualizado");
      refresh();
    },
    onError,
  });

  const reschedule = useMutation({
    mutationFn: (v: { id: string; startsAt: string }) => api.reschedule(v.id, v.startsAt),
    onSuccess: () => {
      toast.success("Cita reagendada");
      refresh();
    },
    onError,
  });

  return { changeStatus, reschedule };
}
