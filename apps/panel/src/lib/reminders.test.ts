import { describe, expect, it } from "vitest";
import { reminderProgress, reminderText } from "./reminders";

describe("reminderText", () => {
  it("incluye nombre, servicio, hora en Cochabamba y pide avisar si no asiste", () => {
    // 14:00 UTC = 10:00 en Cochabamba (UTC-4)
    const t = reminderText({ requesterName: "Ana", serviceName: "Consulta", startsAt: "2030-03-05T14:00:00.000Z" });
    expect(t).toContain("Ana");
    expect(t).toContain("Consulta");
    expect(t).toContain("10:00");
    expect(t).toContain("avísenos");
  });
});

describe("reminderProgress", () => {
  it("cuenta las citas con recordatorio marcado", () => {
    expect(reminderProgress([{ reminderSentAt: "2030-01-01T00:00:00Z" }, { reminderSentAt: null }])).toEqual({ done: 1, total: 2 });
    expect(reminderProgress([])).toEqual({ done: 0, total: 0 });
  });
});
