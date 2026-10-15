import { useAuth } from "@clerk/clerk-react";
import { useCallback } from "react";
import type { AppointmentStatus, ExceptionInput, WeeklyScheduleInput } from "@dr-vargas/shared";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface AppointmentDto {
  id: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  requesterName: string;
  requesterPhone: string;
  reason: string | null;
  patientId: string | null;
  version: number;
  serviceId: string;
  serviceName: string;
  createdAt: string;
}

export interface DayConfig {
  weekday: number;
  ranges: { startMinute: number; endMinute: number; slotMinutes: number }[];
  breaks: { startMinute: number; endMinute: number }[];
}

export interface ExceptionDto {
  date: string;
  blocked: boolean;
  startMinute: number | null;
  endMinute: number | null;
  slotMinutes: number | null;
  note: string | null;
}

export interface SlotDto {
  startMinute: number;
  label: string;
}

/** Cliente de la API privada. El token de Clerk se obtiene en cada llamada; el servidor lo verifica siempre. */
export function useApi() {
  const { getToken } = useAuth();

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getToken();
      let res: Response;
      try {
        res = await fetch(`${API_BASE}${path}`, {
          ...init,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}`, ...(init?.headers ?? {}) },
        });
      } catch {
        throw new ApiError(0, "NETWORK", "Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.");
      }
      if (!res.ok) {
        let code = "ERROR";
        let message = "Ocurrió un error inesperado.";
        try {
          const body = (await res.json()) as { error?: { code?: string; message?: string } };
          code = body.error?.code ?? code;
          message = body.error?.message ?? message;
        } catch {
          /* respuesta sin JSON */
        }
        throw new ApiError(res.status, code, message);
      }
      return (await res.json()) as T;
    },
    [getToken],
  );

  return {
    me: () => request<{ id: string; displayName: string; role: "doctor" | "assistant" }>("/api/me"),
    listAppointments: (params: { status?: AppointmentStatus; from?: string; to?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params.status) q.set("status", params.status);
      if (params.from) q.set("from", params.from);
      if (params.to) q.set("to", params.to);
      if (params.limit) q.set("limit", String(params.limit));
      return request<{ appointments: AppointmentDto[] }>(`/api/appointments?${q}`).then((r) => r.appointments);
    },
    changeStatus: (id: string, to: AppointmentStatus, note?: string) =>
      request<{ appointment: AppointmentDto }>(`/api/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ to, note }) }),
    reschedule: (id: string, startsAt: string, note?: string) =>
      request<{ appointment: AppointmentDto }>(`/api/appointments/${id}/reschedule`, { method: "POST", body: JSON.stringify({ startsAt, note }) }),
    slots: (serviceId: string, date: string) =>
      request<{ slots: SlotDto[] }>(`/api/public/availability?serviceId=${serviceId}&date=${date}`).then((r) => r.slots),
    getAvailability: () => request<{ days: DayConfig[]; exceptions: ExceptionDto[] }>("/api/availability"),
    saveWeekly: (body: WeeklyScheduleInput) => request<{ ok: true }>("/api/availability/weekly", { method: "PUT", body: JSON.stringify(body) }),
    saveException: (date: string, body: ExceptionInput) =>
      request<{ ok: true }>(`/api/availability/exceptions/${date}`, { method: "PUT", body: JSON.stringify(body) }),
    deleteException: (date: string) => request<{ ok: true }>(`/api/availability/exceptions/${date}`, { method: "DELETE" }),
  };
}
