const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const digits = (s: string) => s.replace(/\D/g, "");

/** Coincide por nombre, servicio o motivo (sin tildes ni mayusculas) o por telefono (solo digitos). */
export function matchesAppointment(a: { requesterName: string; requesterPhone: string; serviceName: string; reason?: string | null }, query: string): boolean {
  const q = norm(query.trim());
  if (!q) return true;
  const hay = norm(`${a.requesterName} ${a.serviceName} ${a.reason ?? ""}`);
  if (q.split(/\s+/).every((w) => hay.includes(w))) return true;
  const d = digits(query);
  return d.length >= 3 && digits(a.requesterPhone).includes(d);
}
