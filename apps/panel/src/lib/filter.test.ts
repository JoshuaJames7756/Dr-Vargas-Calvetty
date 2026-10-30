import { describe, expect, it } from "vitest";
import { matchesAppointment } from "./filter";

const a = { requesterName: "María Pérez", requesterPhone: "70344225", serviceName: "Control prenatal", reason: null };

describe("matchesAppointment", () => {
  it("vacio coincide con todo", () => expect(matchesAppointment(a, "  ")).toBe(true));
  it("ignora tildes y mayusculas", () => expect(matchesAppointment(a, "maria perez")).toBe(true));
  it("busca por servicio", () => expect(matchesAppointment(a, "prenatal")).toBe(true));
  it("busca por telefono aunque tenga espacios o guiones", () => expect(matchesAppointment(a, "703-442")).toBe(true));
  it("no coincide con otro nombre", () => expect(matchesAppointment(a, "lucia")).toBe(false));
  it("un telefono muy corto no cuenta", () => expect(matchesAppointment(a, "70")).toBe(false));
});
