import type { AppointmentRequestInput } from "@dr-vargas/shared";

/** En produccion el sitio y la API comparten origen. En desarrollo, PUBLIC_API_URL apunta al Worker local. */
const API_BASE = (import.meta.env.PUBLIC_API_URL as string | undefined) ?? "";

export interface PublicService {
  id: string;
  slug: string;
  name: string;
  specialty: string;
  durationMinutes: number;
  bookable: boolean;
}

export interface SlotDto {
  startMinute: number;
  label: string;
}

export interface AvailabilityDto {
  date: string;
  timezone: string;
  durationMinutes: number;
  slots: SlotDto[];
}

export interface RequestCreatedDto {
  status: "PENDING";
  message: string;
  requestId: string;
  startsAt: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "NETWORK", "No pudimos conectarnos. Revisa tu conexión a internet e inténtalo de nuevo.");
  }

  if (!res.ok) {
    let code = "ERROR";
    let message = "Ocurrió un error inesperado. Inténtalo de nuevo.";
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      /* cuerpo no JSON: se conserva el mensaje generico */
    }
    if (res.status === 400 && code === "ERROR") message = "Revisa los datos ingresados e inténtalo de nuevo.";
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export const fetchServices = () => request<{ services: PublicService[] }>("/api/public/services").then((r) => r.services);

export const fetchAvailability = (serviceId: string, date: string) =>
  request<AvailabilityDto>(`/api/public/availability?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`);

export const submitAppointmentRequest = (input: AppointmentRequestInput) =>
  request<RequestCreatedDto>("/api/public/appointment-requests", { method: "POST", body: JSON.stringify(input) });
