import { useAuth } from "@clerk/clerk-react";
import { useCallback } from "react";
import type { AppointmentStatus, ExceptionInput, PatientInput, WeeklyScheduleInput } from "@dr-vargas/shared";

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
  /** Cuando el personal marco el recordatorio como enviado (null = sin recordar). */
  reminderSentAt: string | null;
  version: number;
  serviceId: string;
  serviceName: string;
  createdAt: string;
}

export interface PatientDto {
  id: string;
  fullName: string;
  phone: string;
  birthDate: string | null;
  email: string | null;
  createdAt: string;
}

export interface PatientAppointmentDto {
  id: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  serviceName: string;
}

export interface NoteDto {
  id: string;
  body: string;
  appointmentId: string | null;
  amendsId: string | null;
  createdAt: string;
  authorName: string;
  /** true si existe una correccion posterior de esta nota. */
  superseded: boolean;
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

export interface DocumentDto {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface SlotDto {
  startMinute: number;
  label: string;
}

/** Cliente de la API privada. El token de Clerk se obtiene en cada llamada; el servidor lo verifica siempre. */
export function useApi() {
  const { getToken } = useAuth();

  /** Llamada autenticada. Convierte cualquier fallo en un ApiError con mensaje comprensible. */
  const send = useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const token = await getToken();
      let res: Response;
      try {
        res = await fetch(`${API_BASE}${path}`, {
          ...init,
          // Con FormData el navegador pone su propio Content-Type (con el boundary): no se fuerza JSON.
          headers: {
            ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
            Authorization: `Bearer ${token ?? ""}`,
            ...(init?.headers ?? {}),
          },
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
      return res;
    },
    [getToken],
  );

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => (await send(path, init)).json() as Promise<T>, [send]);

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
    setReminder: (id: string, sent: boolean) =>
      request<{ appointment: { id: string; reminderSentAt: string | null } }>(`/api/appointments/${id}/reminder`, { method: "POST", body: JSON.stringify({ sent }) }),
    slots: (serviceId: string, date: string) =>
      request<{ slots: SlotDto[] }>(`/api/public/availability?serviceId=${serviceId}&date=${date}`).then((r) => r.slots),
    getAvailability: () => request<{ days: DayConfig[]; exceptions: ExceptionDto[] }>("/api/availability"),
    saveWeekly: (body: WeeklyScheduleInput) => request<{ ok: true }>("/api/availability/weekly", { method: "PUT", body: JSON.stringify(body) }),
    saveException: (date: string, body: ExceptionInput) =>
      request<{ ok: true }>(`/api/availability/exceptions/${date}`, { method: "PUT", body: JSON.stringify(body) }),
    searchPatients: (q: string, offset = 0) => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (offset) p.set("offset", String(offset));
      return request<{ patients: PatientDto[]; hasMore: boolean }>(`/api/patients?${p}`);
    },
    getPatient: (id: string) => request<{ patient: PatientDto; appointments: PatientAppointmentDto[] }>(`/api/patients/${id}`),
    createPatient: (body: PatientInput) => request<{ patient: PatientDto }>("/api/patients", { method: "POST", body: JSON.stringify(body) }),
    updatePatient: (id: string, body: PatientInput) => request<{ patient: PatientDto }>(`/api/patients/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    linkAppointment: (appointmentId: string, patientId?: string) =>
      request<{ patientId: string; created: boolean }>(`/api/appointments/${appointmentId}/patient`, { method: "POST", body: JSON.stringify({ patientId }) }),
    listNotes: (patientId: string) => request<{ notes: NoteDto[] }>(`/api/patients/${patientId}/notes`).then((r) => r.notes),
    addNote: (patientId: string, body: string, amendsId?: string) =>
      request<{ note: { id: string } }>(`/api/patients/${patientId}/notes`, { method: "POST", body: JSON.stringify({ body, amendsId }) }),
    listDocuments: (patientId: string) => request<{ documents: DocumentDto[] }>(`/api/patients/${patientId}/documents`).then((r) => r.documents),
    uploadDocument: (patientId: string, title: string, file: File) => {
      const form = new FormData();
      form.set("title", title);
      form.set("file", file);
      return request<{ document: { id: string } }>(`/api/patients/${patientId}/documents`, { method: "POST", body: form });
    },
    /** Descarga el archivo como blob (con la sesion). El servidor deja constancia de quien lo abrio. */
    downloadDocument: async (id: string): Promise<Blob> => (await send(`/api/documents/${id}/file`)).blob(),
    deleteDocument: (id: string) => request<{ ok: true }>(`/api/documents/${id}`, { method: "DELETE" }),
    deleteException: (date: string) => request<{ ok: true }>(`/api/availability/exceptions/${date}`, { method: "DELETE" }),
  };
}
