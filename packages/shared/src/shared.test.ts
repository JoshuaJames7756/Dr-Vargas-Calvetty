import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  APPOINTMENT_STATUSES,
  appointmentRequestSchema,
  canTransition,
  computeSlots,
  localToUtc,
  minutesToHHMM,
  weekdayOf,
  whatsappLink,
} from "./index";

describe("transiciones de estado de citas", () => {
  it("permite confirmar una solicitud pendiente", () => {
    expect(canTransition("PENDING", "CONFIRMED")).toBe(true);
  });

  it("no permite pasar de PENDING a COMPLETED", () => {
    expect(canTransition("PENDING", "COMPLETED")).toBe(false);
  });

  it("los estados finales no tienen salida", () => {
    for (const s of ["REJECTED", "CANCELLED", "COMPLETED", "NO_SHOW", "RESCHEDULED"] as const) {
      expect(ALLOWED_TRANSITIONS[s]).toHaveLength(0);
    }
  });

  it("cubre todos los estados definidos", () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...APPOINTMENT_STATUSES].sort());
  });
});

describe("disponibilidad", () => {
  const rules = [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60, slotMinutes: 30 }];

  it("genera cupos de 30 min un lunes", () => {
    const slots = computeSlots({ date: "2026-10-19", rules, breaks: [], busy: [], serviceMinutes: 30 });
    expect(slots).toHaveLength(6);
    expect(minutesToHHMM(slots[0]!.startMinute)).toBe("09:00");
    expect(minutesToHHMM(slots.at(-1)!.startMinute)).toBe("11:30");
  });

  it("2026-10-19 es lunes", () => {
    expect(weekdayOf("2026-10-19")).toBe(1);
  });

  it("no genera cupos en un dia sin reglas", () => {
    expect(computeSlots({ date: "2026-10-20", rules, breaks: [], busy: [], serviceMinutes: 30 })).toHaveLength(0);
  });

  it("excluye descansos y citas ocupadas", () => {
    const slots = computeSlots({
      date: "2026-10-19",
      rules,
      breaks: [{ startMinute: 10 * 60, endMinute: 10 * 60 + 30 }],
      busy: [{ startMinute: 9 * 60, endMinute: 9 * 60 + 30 }],
      serviceMinutes: 30,
    });
    const starts = slots.map((s) => minutesToHHMM(s.startMinute));
    expect(starts).not.toContain("09:00");
    expect(starts).not.toContain("10:00");
    expect(starts).toContain("09:30");
  });

  it("un dia bloqueado no tiene cupos", () => {
    const slots = computeSlots({
      date: "2026-10-19",
      rules,
      breaks: [],
      busy: [],
      serviceMinutes: 30,
      exception: { date: "2026-10-19", blocked: true },
    });
    expect(slots).toHaveLength(0);
  });

  it("una consulta de 60 min ocupa dos cupos consecutivos", () => {
    const slots = computeSlots({ date: "2026-10-19", rules, breaks: [], busy: [], serviceMinutes: 60 });
    expect(slots[0]).toEqual({ startMinute: 540, endMinute: 600 });
  });

  it("descarta cupos pasados y respeta la anticipacion minima", () => {
    const slots = computeSlots({
      date: "2026-10-19",
      rules,
      breaks: [],
      busy: [],
      serviceMinutes: 30,
      nowMinute: 9 * 60 + 10,
      minLeadMinutes: 60,
    });
    expect(minutesToHHMM(slots[0]!.startMinute)).toBe("10:30");
  });

  it("convierte hora local de La Paz a UTC (UTC-4)", () => {
    expect(localToUtc("2026-10-19", 9 * 60).toISOString()).toBe("2026-10-19T13:00:00.000Z");
  });
});

describe("solicitud de cita", () => {
  const valid = {
    fullName: "Maria Perez Lopez",
    phone: "70344225",
    serviceId: "3f2b0f3e-6c1d-4a58-9a52-7d1f2d5b1a10",
    startsAt: "2026-10-19T13:00:00.000Z",
    turnstileToken: "token",
    consent: true as const,
  };

  it("acepta una solicitud valida", () => {
    expect(appointmentRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("normaliza el telefono", () => {
    const r = appointmentRequestSchema.parse({ ...valid, phone: "7034 4225" });
    expect(r.phone).toBe("70344225");
  });

  it("rechaza telefono invalido", () => {
    expect(appointmentRequestSchema.safeParse({ ...valid, phone: "123" }).success).toBe(false);
  });

  it("exige consentimiento", () => {
    expect(appointmentRequestSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });

  it("limita el motivo a 280 caracteres", () => {
    expect(appointmentRequestSchema.safeParse({ ...valid, reason: "x".repeat(281) }).success).toBe(false);
  });
});

describe("whatsapp", () => {
  it("genera un enlace wa.me con codigo de pais", () => {
    expect(whatsappLink()).toBe("https://wa.me/59170344225");
  });

  it("codifica el mensaje", () => {
    expect(whatsappLink("Hola doctor")).toBe("https://wa.me/59170344225?text=Hola%20doctor");
  });
});

import { exceptionSchema, weeklyScheduleSchema } from "./index";

describe("horario semanal (validacion)", () => {
  const day = (weekday: number, ranges: object[], breaks: object[] = []) => ({ weekday, ranges, breaks });

  it("acepta un horario con descanso", () => {
    const r = weeklyScheduleSchema.safeParse({
      days: [day(1, [{ startMinute: 540, endMinute: 1080, slotMinutes: 30 }], [{ startMinute: 780, endMinute: 840 }])],
    });
    expect(r.success).toBe(true);
  });

  it("rechaza rangos solapados", () => {
    const r = weeklyScheduleSchema.safeParse({
      days: [day(1, [{ startMinute: 540, endMinute: 700, slotMinutes: 30 }, { startMinute: 600, endMinute: 900, slotMinutes: 30 }])],
    });
    expect(r.success).toBe(false);
  });

  it("rechaza inicio posterior al fin y dias repetidos", () => {
    expect(weeklyScheduleSchema.safeParse({ days: [day(1, [{ startMinute: 900, endMinute: 600, slotMinutes: 30 }])] }).success).toBe(false);
    expect(weeklyScheduleSchema.safeParse({ days: [day(1, []), day(1, [])] }).success).toBe(false);
  });

  it("un dia bloqueado no necesita horas, uno alternativo si", () => {
    expect(exceptionSchema.safeParse({ blocked: true }).success).toBe(true);
    expect(exceptionSchema.safeParse({ blocked: false }).success).toBe(false);
    expect(exceptionSchema.safeParse({ blocked: false, startMinute: 540, endMinute: 720, slotMinutes: 30 }).success).toBe(true);
  });
});

import { patientWhatsappLink } from "./index";
describe("whatsapp hacia pacientes", () => {
  it("agrega el codigo de pais cuando falta", () => {
    expect(patientWhatsappLink("7034 4225")).toBe("https://wa.me/59170344225");
  });
  it("no duplica el codigo de pais", () => {
    expect(patientWhatsappLink("+591 70344225", "Hola")).toBe("https://wa.me/59170344225?text=Hola");
  });
});
