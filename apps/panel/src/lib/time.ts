/** Todo se muestra en hora de Cochabamba (UTC-4 fijo), sin depender de la zona del dispositivo. */
const TZ = "America/La_Paz";

export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(new Date(iso));

export const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("es-BO", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date(iso));

export const fmtDayShort = (iso: string) =>
  new Intl.DateTimeFormat("es-BO", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso));

/** Fecha local YYYY-MM-DD de un instante. */
export const localDate = (iso: string | Date) => new Date(new Date(iso).getTime() - 4 * 3600_000).toISOString().slice(0, 10);

export const todayLocal = () => localDate(new Date());

export const addDays = (date: string, n: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** Rango UTC [inicio, fin) de un dia local. */
export const dayRangeUtc = (date: string, days = 1) => ({
  from: new Date(`${date}T04:00:00.000Z`).toISOString(),
  to: new Date(new Date(`${date}T04:00:00.000Z`).getTime() + days * 86_400_000).toISOString(),
});

export const minutesToHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const hhmmToMinutes = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
// Orden de presentacion: lunes a domingo.
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Meses como "YYYY-MM" (hora de Cochabamba). */
export const monthOf = (date: string) => date.slice(0, 7);
export const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
/** Rango UTC [inicio, fin) del mes local. */
export const monthRangeUtc = (ym: string) => ({
  from: new Date(`${ym}-01T04:00:00.000Z`).toISOString(),
  to: new Date(`${addMonths(ym, 1)}-01T04:00:00.000Z`).toISOString(),
});
export const fmtMonth = (ym: string) => new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-15T12:00:00Z`));
