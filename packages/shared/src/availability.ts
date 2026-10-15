/**
 * Calculo de disponibilidad (funcion pura, sin acceso a datos, facil de probar).
 *
 * Trabajamos con minutos desde medianoche en la hora local del consultorio.
 * Bolivia no usa horario de verano (UTC-4 fijo), pero el calculo de instantes
 * se hace a traves de una funcion inyectable para no acoplarnos a esa suposicion.
 */

export interface WeeklyRule {
  /** 0 = domingo ... 6 = sabado */
  weekday: number;
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
}

export interface BreakRange {
  startMinute: number;
  endMinute: number;
}

export interface DayException {
  /** YYYY-MM-DD local */
  date: string;
  /** true = dia bloqueado completo. Si no, usa `ranges` como horario alternativo. */
  blocked: boolean;
  ranges?: { startMinute: number; endMinute: number; slotMinutes: number }[];
}

export interface Slot {
  startMinute: number;
  endMinute: number;
}

export interface BusyRange {
  startMinute: number;
  endMinute: number;
}

export interface ComputeSlotsInput {
  date: string;
  rules: WeeklyRule[];
  breaks: BreakRange[];
  exception?: DayException;
  busy: BusyRange[];
  /** Duracion del servicio solicitado. Si es menor al slot, se usa el slot. */
  serviceMinutes: number;
  /** Minuto local actual si `date` es hoy; los slots anteriores se descartan. */
  nowMinute?: number;
  /** Anticipacion minima en minutos para solicitar. */
  minLeadMinutes?: number;
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function overlaps(a: Slot, b: { startMinute: number; endMinute: number }): boolean {
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

export function computeSlots(input: ComputeSlotsInput): Slot[] {
  const { date, rules, breaks, exception, busy, serviceMinutes, nowMinute, minLeadMinutes = 0 } = input;

  if (exception?.blocked) return [];

  const ranges = exception?.ranges
    ? exception.ranges
    : rules.filter((r) => r.weekday === weekdayOf(date));

  const slots: Slot[] = [];
  for (const range of ranges) {
    const step = range.slotMinutes;
    const length = Math.max(serviceMinutes, step);
    for (let start = range.startMinute; start + length <= range.endMinute; start += step) {
      const slot: Slot = { startMinute: start, endMinute: start + length };
      if (nowMinute !== undefined && slot.startMinute < nowMinute + minLeadMinutes) continue;
      if (breaks.some((b) => overlaps(slot, b))) continue;
      if (busy.some((b) => overlaps(slot, b))) continue;
      slots.push(slot);
    }
  }
  return slots.sort((a, b) => a.startMinute - b.startMinute);
}

export function minutesToHHMM(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Convierte fecha local + minuto a un instante UTC. Bolivia: UTC-4 fijo, sin horario de verano. */
export function localToUtc(date: string, minute: number, offsetMinutes = -4 * 60): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 0, minute - offsetMinutes, 0));
}
