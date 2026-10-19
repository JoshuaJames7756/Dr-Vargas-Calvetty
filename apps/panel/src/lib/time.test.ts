import { describe, expect, it } from "vitest";
import { addMonths, monthRangeUtc } from "./time";

describe("meses del consultorio", () => {
  it("suma meses cruzando de anio", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
  it("el rango del mes empieza a las 00:00 locales (04:00 UTC)", () => {
    expect(monthRangeUtc("2026-10")).toEqual({ from: "2026-10-01T04:00:00.000Z", to: "2026-11-01T04:00:00.000Z" });
  });
});
