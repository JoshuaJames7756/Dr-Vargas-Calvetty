import { z } from "zod";

const minute = z.number().int().min(0).max(1440);

const rangeSchema = z
  .object({
    startMinute: minute,
    endMinute: minute,
    slotMinutes: z.number().int().min(5).max(240),
  })
  .refine((r) => r.startMinute < r.endMinute, { message: "La hora de inicio debe ser anterior a la de fin" });

const breakSchema = z
  .object({ startMinute: minute, endMinute: minute })
  .refine((r) => r.startMinute < r.endMinute, { message: "El descanso debe terminar después de empezar" });

function overlapping(items: { startMinute: number; endMinute: number }[]): boolean {
  const sorted = [...items].sort((a, b) => a.startMinute - b.startMinute);
  return sorted.some((r, i) => i > 0 && r.startMinute < sorted[i - 1]!.endMinute);
}

const daySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    ranges: z.array(rangeSchema).max(4),
    breaks: z.array(breakSchema).max(4),
  })
  .superRefine((d, ctx) => {
    if (overlapping(d.ranges)) ctx.addIssue({ code: "custom", message: "Los horarios de un mismo día no pueden solaparse", path: ["ranges"] });
    if (overlapping(d.breaks)) ctx.addIssue({ code: "custom", message: "Los descansos no pueden solaparse", path: ["breaks"] });
  });

/** Horario semanal completo. Un dia sin rangos es un dia sin atencion. */
export const weeklyScheduleSchema = z
  .object({ days: z.array(daySchema).max(7) })
  .refine((v) => new Set(v.days.map((d) => d.weekday)).size === v.days.length, { message: "Día repetido" });

export type WeeklyScheduleInput = z.infer<typeof weeklyScheduleSchema>;

export const exceptionSchema = z
  .object({
    blocked: z.boolean(),
    startMinute: minute.optional(),
    endMinute: minute.optional(),
    slotMinutes: z.number().int().min(5).max(240).optional(),
    note: z.string().trim().max(200).optional(),
  })
  .refine(
    (e) => e.blocked || (e.startMinute !== undefined && e.endMinute !== undefined && e.slotMinutes !== undefined && e.startMinute < e.endMinute),
    { message: "Un horario alternativo necesita inicio, fin y duración de cupo" },
  );

export type ExceptionInput = z.infer<typeof exceptionSchema>;

export const dateParamSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
